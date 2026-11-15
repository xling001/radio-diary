/* ===========================================================
   core/catalog.js — 练习素材与体检目录门面 (Catalog Facade)

   将素材库与体检卡组目录管理从纯声学门面 core/index.js 中拆离，
   确保声学分析层不耦合 localStorage 与状态层。
   =========================================================== */

export {
  CHECKUP_ITEMS,
  BUILTIN_CATEGORIES,
  CATEGORIES,
  BUILTIN_SETS,
  LibraryStore,
  getAllCategories,
  addCustomCategory,
  removeCustomCategory,
  updateSetMeta,
} from '../store/library.js';
