// Catálogo de iconos FontAwesome seleccionables para categorías.
// Cada categoría guarda una `icon` (la clave del map, p.ej. "hamburger").
// Si no tiene icono asignado, Store.jsx usa la heurística por nombre.
import {
  faUtensils, faHamburger, faBurger, faPizzaSlice, faHotdog, faDrumstickBite,
  faBacon, faFish, faShrimp, faEgg, faCheese, faBreadSlice, faPlateWheat,
  faBowlRice, faBowlFood, faLeaf, faSeedling, faCarrot, faPepperHot,
  faAppleWhole, faLemon, faIceCream, faCookieBite, faCandyCane, faCakeCandles,
  faCoffee, faMugHot, faWineBottle, faBeer, faMartiniGlassCitrus, faWhiskeyGlass,
  faChampagneGlasses, faBottleWater, faJar, faMortarPestle, faFire, faStar,
  faHeart, faGift, faTag, faBagShopping, faStore,
} from '@fortawesome/free-solid-svg-icons';

// key => { label (para el picker), icon (objeto FontAwesome) }
export const CATEGORY_ICONS = {
  utensils:      { label: 'General',        icon: faUtensils },
  hamburger:     { label: 'Hamburguesa',    icon: faHamburger },
  burger:        { label: 'Burger',         icon: faBurger },
  pizza:         { label: 'Pizza',          icon: faPizzaSlice },
  hotdog:        { label: 'Hot dog',        icon: faHotdog },
  chicken:       { label: 'Pollo',          icon: faDrumstickBite },
  bacon:         { label: 'Tocino',         icon: faBacon },
  fish:          { label: 'Pescado',        icon: faFish },
  shrimp:        { label: 'Mariscos',       icon: faShrimp },
  egg:           { label: 'Huevo',          icon: faEgg },
  cheese:        { label: 'Queso',          icon: faCheese },
  bread:         { label: 'Pan',            icon: faBreadSlice },
  plate:         { label: 'Plato',          icon: faPlateWheat },
  rice:          { label: 'Arroz / Bowl',   icon: faBowlRice },
  bowl:          { label: 'Sopa / Bowl',    icon: faBowlFood },
  salad:         { label: 'Ensalada',       icon: faLeaf },
  vegan:         { label: 'Vegano',         icon: faSeedling },
  carrot:        { label: 'Verduras',       icon: faCarrot },
  spicy:         { label: 'Picante',        icon: faPepperHot },
  fruit:         { label: 'Fruta',          icon: faAppleWhole },
  lemon:         { label: 'Cítricos',       icon: faLemon },
  icecream:      { label: 'Helado',         icon: faIceCream },
  cookie:        { label: 'Galleta',        icon: faCookieBite },
  candy:         { label: 'Dulces',         icon: faCandyCane },
  cake:          { label: 'Torta',          icon: faCakeCandles },
  coffee:        { label: 'Café',           icon: faCoffee },
  tea:           { label: 'Té / Caliente',  icon: faMugHot },
  wine:          { label: 'Vino',           icon: faWineBottle },
  beer:          { label: 'Cerveza',        icon: faBeer },
  cocktail:      { label: 'Coctel',         icon: faMartiniGlassCitrus },
  whiskey:       { label: 'Licor',          icon: faWhiskeyGlass },
  champagne:     { label: 'Champaña',       icon: faChampagneGlasses },
  water:         { label: 'Agua',           icon: faBottleWater },
  jar:           { label: 'Conservas',      icon: faJar },
  sauce:         { label: 'Salsas',         icon: faMortarPestle },
  fire:          { label: 'Parrilla',       icon: faFire },
  star:          { label: 'Destacado',      icon: faStar },
  heart:         { label: 'Favoritos',      icon: faHeart },
  gift:          { label: 'Promo / Regalo', icon: faGift },
  tag:           { label: 'Ofertas',        icon: faTag },
  bag:           { label: 'Para llevar',    icon: faBagShopping },
  store:         { label: 'Tienda',         icon: faStore },
};

// Lista ordenada para renderizar el selector.
export const CATEGORY_ICON_LIST = Object.entries(CATEGORY_ICONS).map(
  ([key, { label, icon }]) => ({ key, label, icon })
);

// Devuelve el objeto de icono FontAwesome para una clave guardada, o null.
export function getCategoryIcon(key) {
  if (!key) return null;
  return CATEGORY_ICONS[key]?.icon || null;
}
