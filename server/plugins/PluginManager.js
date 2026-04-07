import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';
import { Router } from 'express';
import HookSystem from './HookSystem.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLUGINS_DIR = path.join(__dirname, 'installed');

// MySQL JSON columns return objects already parsed; plain strings need JSON.parse
function safeParse(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

class PluginManager {
  constructor(app, pool, io) {
    this.app = app;
    this.pool = pool;
    this.io = io;
    this.hooks = new HookSystem();
    this.loadedPlugins = new Map();
    this.pluginRouters = new Map();
    this.parentRouter = Router();

    // Mount parent router for plugin sub-routes (per-plugin API routes)
    app.use('/api/plugins/run', this.parentRouter);

    // Ensure plugins directory exists
    if (!fs.existsSync(PLUGINS_DIR)) {
      fs.mkdirSync(PLUGINS_DIR, { recursive: true });
    }
  }

  /**
   * Ensure plugin tables exist (called before any DB operation)
   */
  async ensureTables() {
    if (this._tablesReady) return;
    try {
      await this.pool.execute(`
        CREATE TABLE IF NOT EXISTS plugins (
          id INT PRIMARY KEY AUTO_INCREMENT,
          plugin_id VARCHAR(100) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          version VARCHAR(50) NOT NULL,
          description TEXT,
          author VARCHAR(255),
          is_active BOOLEAN DEFAULT FALSE,
          hooks JSON,
          admin_slots JSON,
          store_slots JSON,
          settings_schema JSON,
          has_routes BOOLEAN DEFAULT FALSE,
          installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await this.pool.execute(`
        CREATE TABLE IF NOT EXISTS plugin_settings (
          id INT PRIMARY KEY AUTO_INCREMENT,
          plugin_id VARCHAR(100) NOT NULL,
          store_id INT NOT NULL,
          settings JSON NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_plugin_store (plugin_id, store_id),
          FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
        )
      `);
      this._tablesReady = true;
    } catch (error) {
      console.error('🔌 Error ensuring plugin tables:', error.message);
    }
  }

  /**
   * Install a plugin from a ZIP buffer
   */
  async install(zipBuffer) {
    await this.ensureTables();
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

    // Find plugin.json - could be at root or inside a folder
    let pluginJsonEntry = null;
    let rootPrefix = '';

    for (const entry of entries) {
      const normalized = entry.entryName.replace(/\\/g, '/');
      if (normalized.endsWith('plugin.json') && !entry.isDirectory) {
        const parts = normalized.split('/').filter(Boolean);
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
    const resolvedPluginDir = path.resolve(pluginDir);
    fs.mkdirSync(resolvedPluginDir, { recursive: true });
    console.log(`🔌 Extracting to: ${resolvedPluginDir}`);
    console.log(`🔌 ZIP entries: ${entries.map(e => e.entryName).join(', ')}`);
    console.log(`🔌 Root prefix: "${rootPrefix}"`);

    let extractedCount = 0;
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      let entryPath = entry.entryName.replace(/\\/g, '/');
      if (rootPrefix) {
        const normalizedPrefix = rootPrefix.replace(/\\/g, '/');
        if (entryPath.startsWith(normalizedPrefix)) {
          entryPath = entryPath.slice(normalizedPrefix.length);
        }
      }
      if (!entryPath) continue;

      // Security: prevent zip slip
      const targetPath = path.resolve(resolvedPluginDir, entryPath);
      if (!targetPath.startsWith(resolvedPluginDir)) {
        console.log(`🔌 SKIP (zip slip): ${entryPath} -> ${targetPath}`);
        continue;
      }

      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(targetPath, entry.getData());
      extractedCount++;
      console.log(`🔌 Extracted: ${entryPath} -> ${targetPath}`);
    }
    console.log(`🔌 Extracted ${extractedCount} files to ${resolvedPluginDir}`);

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
    await this.ensureTables();
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

          // Route delegation under /api/plugins/run/<pluginId>/
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
    await this.ensureTables();
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
    await this.ensureTables();
    const [rows] = await this.pool.execute('SELECT * FROM plugins ORDER BY name');
    return rows.map(row => ({
      ...row,
      hooks: safeParse(row.hooks, []),
      admin_slots: safeParse(row.admin_slots, []),
      store_slots: safeParse(row.store_slots, []),
      settings_schema: safeParse(row.settings_schema, {})
    }));
  }

  /**
   * Get client manifest - active plugins metadata for frontend
   */
  async getClientManifest() {
    await this.ensureTables();
    const [rows] = await this.pool.execute(
      'SELECT plugin_id, name, version, admin_slots, store_slots, settings_schema FROM plugins WHERE is_active = TRUE'
    );
    return rows.map(row => ({
      id: row.plugin_id,
      name: row.name,
      version: row.version,
      adminSlots: safeParse(row.admin_slots, []),
      storeSlots: safeParse(row.store_slots, []),
      hasSettings: Object.keys(safeParse(row.settings_schema, {})).length > 0,
      adminJs: (() => {
        const p = path.join(PLUGINS_DIR, row.plugin_id, 'admin.js');
        const exists = fs.existsSync(p);
        if (!exists) console.log(`🔌 [Manifest] admin.js NOT found: ${p}`);
        return exists ? `/api/plugins/static/${row.plugin_id}/admin.js` : null;
      })(),
      storeJs: (() => {
        const p = path.join(PLUGINS_DIR, row.plugin_id, 'store.js');
        const exists = fs.existsSync(p);
        if (!exists) console.log(`🔌 [Manifest] store.js NOT found: ${p}`);
        return exists ? `/api/plugins/static/${row.plugin_id}/store.js` : null;
      })()
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
      return safeParse(rows[0].settings, {});
    }
    // Return defaults from schema
    const [pluginRows] = await this.pool.execute(
      'SELECT settings_schema FROM plugins WHERE plugin_id = ?', [pluginId]
    );
    if (pluginRows.length > 0) {
      const schema = safeParse(pluginRows[0].settings_schema, {});
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
