import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';
import { Router } from 'express';
import HookSystem from './HookSystem.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLUGINS_DIR = path.join(__dirname, 'installed');

class PluginManager {
  constructor(app, pool, io) {
    this.app = app;
    this.pool = pool;
    this.io = io;
    this.hooks = new HookSystem();
    this.loadedPlugins = new Map();
    this.pluginRouters = new Map();
    this.parentRouter = Router();

    // Mount parent router for all plugin routes
    app.use('/api/plugins', this.parentRouter);

    // Serve plugin static files (admin.js, store.js, assets)
    this.parentRouter.use('/static', (req, res, next) => {
      const reqPath = req.path;
      const fullPath = path.join(PLUGINS_DIR, reqPath);
      const resolved = path.resolve(fullPath);
      if (!resolved.startsWith(path.resolve(PLUGINS_DIR))) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      if (fs.existsSync(resolved)) {
        return res.sendFile(resolved);
      }
      next();
    });

    // Ensure plugins directory exists
    if (!fs.existsSync(PLUGINS_DIR)) {
      fs.mkdirSync(PLUGINS_DIR, { recursive: true });
    }
  }

  /**
   * Install a plugin from a ZIP buffer
   */
  async install(zipBuffer) {
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

    // Find plugin.json - could be at root or inside a folder
    let pluginJsonEntry = null;
    let rootPrefix = '';

    for (const entry of entries) {
      if (entry.entryName.endsWith('plugin.json') && !entry.isDirectory) {
        const parts = entry.entryName.split('/');
        if (parts.length <= 2) {
          pluginJsonEntry = entry;
          rootPrefix = parts.length === 2 ? parts[0] + '/' : '';
          break;
        }
      }
    }

    if (!pluginJsonEntry) {
      throw new Error('plugin.json no encontrado en el ZIP');
    }

    let pluginJson;
    try {
      pluginJson = JSON.parse(pluginJsonEntry.getData().toString('utf8'));
    } catch {
      throw new Error('plugin.json inválido');
    }

    if (!pluginJson.id || !pluginJson.name || !pluginJson.version) {
      throw new Error('plugin.json debe contener id, name y version');
    }

    const pluginId = pluginJson.id;
    const pluginDir = path.join(PLUGINS_DIR, pluginId);

    // Check if already installed
    const [existing] = await this.pool.execute(
      'SELECT id FROM plugins WHERE plugin_id = ?', [pluginId]
    );
    if (existing.length > 0) {
      // Update: remove old files
      if (fs.existsSync(pluginDir)) {
        fs.rmSync(pluginDir, { recursive: true, force: true });
      }
    }

    // Extract files
    fs.mkdirSync(pluginDir, { recursive: true });
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      let entryPath = entry.entryName;
      if (rootPrefix && entryPath.startsWith(rootPrefix)) {
        entryPath = entryPath.slice(rootPrefix.length);
      }
      if (!entryPath) continue;

      // Security: prevent zip slip
      const targetPath = path.join(pluginDir, entryPath);
      if (!targetPath.startsWith(path.resolve(pluginDir))) {
        continue;
      }

      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(targetPath, entry.getData());
    }

    // Save to database
    if (existing.length > 0) {
      await this.pool.execute(
        `UPDATE plugins SET name = ?, version = ?, description = ?, author = ?,
         hooks = ?, admin_slots = ?, store_slots = ?, settings_schema = ?,
         has_routes = ? WHERE plugin_id = ?`,
        [
          pluginJson.name,
          pluginJson.version,
          pluginJson.description || null,
          pluginJson.author || null,
          JSON.stringify(pluginJson.hooks || []),
          JSON.stringify(pluginJson.adminSlots || []),
          JSON.stringify(pluginJson.storeSlots || []),
          JSON.stringify(pluginJson.settings || {}),
          pluginJson.routes ? 1 : 0,
          pluginId
        ]
      );
    } else {
      await this.pool.execute(
        `INSERT INTO plugins (plugin_id, name, version, description, author, hooks, admin_slots, store_slots, settings_schema, has_routes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pluginId,
          pluginJson.name,
          pluginJson.version,
          pluginJson.description || null,
          pluginJson.author || null,
          JSON.stringify(pluginJson.hooks || []),
          JSON.stringify(pluginJson.adminSlots || []),
          JSON.stringify(pluginJson.storeSlots || []),
          JSON.stringify(pluginJson.settings || {}),
          pluginJson.routes ? 1 : 0
        ]
      );
    }

    console.log(`🔌 Plugin "${pluginJson.name}" v${pluginJson.version} instalado`);
    return pluginJson;
  }

  /**
   * Activate a plugin - load server.js, register hooks/routes
   */
  async activate(pluginId) {
    const [rows] = await this.pool.execute(
      'SELECT * FROM plugins WHERE plugin_id = ?', [pluginId]
    );
    if (rows.length === 0) throw new Error('Plugin no encontrado');

    const plugin = rows[0];
    const pluginDir = path.join(PLUGINS_DIR, pluginId);
    const serverFile = path.join(pluginDir, 'server.js');

    if (this.loadedPlugins.has(pluginId)) {
      await this.deactivateInternal(pluginId);
    }

    const pluginInstance = { id: pluginId, module: null, router: null };

    // Load server.js if exists
    if (fs.existsSync(serverFile)) {
      try {
        // Add cache buster for re-activation
        const serverModule = await import(`file://${serverFile.replace(/\\/g, '/')}?t=${Date.now()}`);

        if (typeof serverModule.init === 'function') {
          const router = Router();
          this.pluginRouters.set(pluginId, router);

          // Route delegation
          this.parentRouter.use(`/${pluginId}`, (req, res, next) => {
            const pluginRouter = this.pluginRouters.get(pluginId);
            if (pluginRouter) {
              return pluginRouter(req, res, next);
            }
            next();
          });

          const context = {
            hooks: {
              on: (hookName, handler) => {
                this.hooks.register(hookName, pluginId, handler);
              }
            },
            router,
            db: this.pool,
            io: this.io,
            getSettings: async (storeId) => {
              return this.getPluginSettings(pluginId, storeId);
            },
            logger: {
              log: (...args) => console.log(`🔌 [${pluginId}]`, ...args),
              error: (...args) => console.error(`🔌 [${pluginId}]`, ...args),
              warn: (...args) => console.warn(`🔌 [${pluginId}]`, ...args)
            }
          };

          await serverModule.init(context);
          pluginInstance.module = serverModule;
          pluginInstance.router = router;
        }
      } catch (error) {
        console.error(`🔌 Error loading server.js for "${pluginId}":`, error);
      }
    }

    this.loadedPlugins.set(pluginId, pluginInstance);

    await this.pool.execute(
      'UPDATE plugins SET is_active = TRUE WHERE plugin_id = ?', [pluginId]
    );

    console.log(`🔌 Plugin "${pluginId}" activado`);
    return true;
  }

  /**
   * Deactivate a plugin
   */
  async deactivate(pluginId) {
    await this.deactivateInternal(pluginId);
    await this.pool.execute(
      'UPDATE plugins SET is_active = FALSE WHERE plugin_id = ?', [pluginId]
    );
    console.log(`🔌 Plugin "${pluginId}" desactivado`);
    return true;
  }

  async deactivateInternal(pluginId) {
    const instance = this.loadedPlugins.get(pluginId);
    if (instance) {
      // Call destroy if available
      if (instance.module && typeof instance.module.destroy === 'function') {
        try {
          await instance.module.destroy();
        } catch (error) {
          console.error(`🔌 Error in destroy for "${pluginId}":`, error);
        }
      }
      // Remove hooks
      this.hooks.unregister(pluginId);
      // Remove router
      this.pluginRouters.delete(pluginId);
      this.loadedPlugins.delete(pluginId);
    }
  }

  /**
   * Uninstall a plugin completely
   */
  async uninstall(pluginId) {
    await this.deactivateInternal(pluginId);

    const pluginDir = path.join(PLUGINS_DIR, pluginId);
    if (fs.existsSync(pluginDir)) {
      fs.rmSync(pluginDir, { recursive: true, force: true });
    }

    await this.pool.execute('DELETE FROM plugin_settings WHERE plugin_id = ?', [pluginId]);
    await this.pool.execute('DELETE FROM plugins WHERE plugin_id = ?', [pluginId]);

    console.log(`🔌 Plugin "${pluginId}" desinstalado`);
    return true;
  }

  /**
   * Load all active plugins on startup
   */
  async loadAllActive() {
    try {
      const [rows] = await this.pool.execute(
        'SELECT plugin_id FROM plugins WHERE is_active = TRUE'
      );
      for (const row of rows) {
        try {
          await this.activate(row.plugin_id);
        } catch (error) {
          console.error(`🔌 Error activating "${row.plugin_id}" on startup:`, error.message);
        }
      }
      console.log(`🔌 ${rows.length} plugin(s) cargados al iniciar`);
    } catch (error) {
      console.error('🔌 Error loading plugins:', error.message);
    }
  }

  /**
   * Get all plugins from DB
   */
  async getAllPlugins() {
    const [rows] = await this.pool.execute('SELECT * FROM plugins ORDER BY name');
    return rows.map(row => ({
      ...row,
      hooks: JSON.parse(row.hooks || '[]'),
      admin_slots: JSON.parse(row.admin_slots || '[]'),
      store_slots: JSON.parse(row.store_slots || '[]'),
      settings_schema: JSON.parse(row.settings_schema || '{}')
    }));
  }

  /**
   * Get client manifest - active plugins metadata for frontend
   */
  async getClientManifest() {
    const [rows] = await this.pool.execute(
      'SELECT plugin_id, name, version, admin_slots, store_slots, settings_schema FROM plugins WHERE is_active = TRUE'
    );
    return rows.map(row => ({
      id: row.plugin_id,
      name: row.name,
      version: row.version,
      adminSlots: JSON.parse(row.admin_slots || '[]'),
      storeSlots: JSON.parse(row.store_slots || '[]'),
      hasSettings: Object.keys(JSON.parse(row.settings_schema || '{}')).length > 0,
      adminJs: fs.existsSync(path.join(PLUGINS_DIR, row.plugin_id, 'admin.js'))
        ? `/api/plugins/static/${row.plugin_id}/admin.js` : null,
      storeJs: fs.existsSync(path.join(PLUGINS_DIR, row.plugin_id, 'store.js'))
        ? `/api/plugins/static/${row.plugin_id}/store.js` : null
    }));
  }

  /**
   * Get plugin settings for a store
   */
  async getPluginSettings(pluginId, storeId) {
    const [rows] = await this.pool.execute(
      'SELECT settings FROM plugin_settings WHERE plugin_id = ? AND store_id = ?',
      [pluginId, storeId]
    );
    if (rows.length > 0) {
      return JSON.parse(rows[0].settings || '{}');
    }
    // Return defaults from schema
    const [pluginRows] = await this.pool.execute(
      'SELECT settings_schema FROM plugins WHERE plugin_id = ?', [pluginId]
    );
    if (pluginRows.length > 0) {
      const schema = JSON.parse(pluginRows[0].settings_schema || '{}');
      const defaults = {};
      for (const [key, config] of Object.entries(schema)) {
        defaults[key] = config.default !== undefined ? config.default : '';
      }
      return defaults;
    }
    return {};
  }

  /**
   * Save plugin settings for a store
   */
  async savePluginSettings(pluginId, storeId, settings) {
    const settingsJson = JSON.stringify(settings);
    await this.pool.execute(
      `INSERT INTO plugin_settings (plugin_id, store_id, settings) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE settings = ?`,
      [pluginId, storeId, settingsJson, settingsJson]
    );
    return true;
  }
}

export default PluginManager;
