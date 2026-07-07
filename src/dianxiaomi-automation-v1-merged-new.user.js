// ==UserScript==
// @name         DXM Automation V1 - NEW v2.1.75
// @namespace    https://codex.local/dianxiaomi-automation-v1
// @version      2.1.75
// @description  DXM listing automation: edit.json, choiceSave payload, dry-run, save validation, run bundle.
// @author       Codex
// @match        https://*.dianxiaomi.com/*
// @match        http://*.dianxiaomi.com/*
// @match        https://dianxiaomi.com/*
// @match        http://dianxiaomi.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const APP_NAME = 'DXM Automation V1';
  const VERSION = '2.1.75';
  const PANEL_ID = 'dxm-automation-v1-new-panel';
  const READONLY_PREFLIGHT_NODE_ID = 'dxm-automation-v1-readonly-preflight-json';
  const POS_KEY = 'dxm-automation-v1-new-position';
  const COLLAPSED_KEY = 'dxm-automation-v1-new-collapsed';
  const DEFAULT_POSTAGE_ID_KEY = 'dxm-single-submit-default-postage-id';
  const DEFAULT_WEIGHT_KEY = 'dxm-single-submit-default-weight';
  const DEFAULT_SUPPLY_PRICE_KEY = 'dxm-single-submit-default-supply-price';
  const DEFAULT_SOURCE_PRICE_KEY = 'dxm-single-submit-default-source-price';
  const DEFAULT_STOCK_KEY = 'dxm-single-submit-default-stock';
  const DEFAULT_SHOP_ID_KEY = 'dxm-single-submit-default-shop-id';
  const TASK_EXCHANGE_RATE_KEY = 'dxm-automation-task-exchange-rate';
  const TASK_PRICE_MULTIPLIER_KEY = 'dxm-automation-task-price-multiplier';
  const DEFAULT_LENGTH_IN_KEY = 'dxm-single-submit-default-length-in';
  const DEFAULT_WIDTH_IN_KEY = 'dxm-single-submit-default-width-in';
  const DEFAULT_HEIGHT_IN_KEY = 'dxm-single-submit-default-height-in';
  const DEFAULT_LENGTH_KEY = 'dxm-single-submit-default-length';
  const DEFAULT_WIDTH_KEY = 'dxm-single-submit-default-width';
  const DEFAULT_HEIGHT_KEY = 'dxm-single-submit-default-height';
  const AMAZON_PUBLIC_BATCH_KEY = 'dxm_amazon_crawlbox_public_batch_v1';
  const AMAZON_SOURCE_ASIN_KEY = 'dxm-automation-amazon-source-asin';
  const AMAZON_PRICE_STORE_KEY = 'dxm_amazon_price_store_v1';
  const ALIEXPRESS_EVIDENCE_STORE_KEY = 'dxm_aliexpress_evidence_store_v1';
  const ALIEXPRESS_EVIDENCE_STORE_SCHEMA_VERSION = 'aliexpress-evidence-store-v1';
  const AMAZON_PRICE_STORE_SCHEMA_VERSION = 'amazon-price-store-v1';
  const CURRENT_PUBLISH_TEST = Object.freeze({
    productId: '167487782002154045',
    asin: 'B09D5Y5HBW',
    titleToken: 'Silicone Sink Strainer',
  });

  const EDIT_PAGE_RULES = Object.freeze({
    postageTemplateId: '111',
    titleMaxChars: 80,
    pcDescriptionMinChars: 500,
    pcDescriptionMinImages: 2,
    pcDescriptionMaxImages: 5,
    marketingImageCount: 2,
    customAttributesDefaultSkip: true,
    customAttributeMaxChars: 70,
    saveRetryLimit: 1,
    aiTitleCapability: 'title optimization',
    aiDescriptionCapability: 'description rewrite',
    flow: 'Amazon -> collection box -> claim -> edit page -> save -> collection box -> publish',
    forbiddenEditPageAction: 'publish from edit page',
  });
  const EDIT_PAGE_EXCLUSIVE_SAMPLE_ID = '167487782006885971';
  const EDIT_PAGE_MINIMAL_EXCLUSIVE_MODE = false;
  let visibleEditRulesAutoAppliedUrl = '';
  let visibleEditRulesWatcherStarted = false;
  let visibleEditRulesPipelineRunning = false;
  const editFieldLocks = {
    active: false,
    fields: {},
    scrollBlocked: 0,
    lockViolations: [],
  };
  const FORBIDDEN_COMMERCE_TERMS = [
    'amazon',
    'amazon.com',
    'aliexpress',
    'ebay',
    'walmart',
    'temu',
    'shein',
    'tiktok',
    'official',
    'guaranteed',
    'best seller',
    'best-selling',
    'free shipping',
    'limited time',
    'hot sale',
    'premium',
    'perfect',
    'amazing',
    'ultimate',
    'original',
  ];
  function getDefaultPostageId() {
    return EDIT_PAGE_RULES.postageTemplateId;
  }

  function getDefaultWeightKg() {
    return getPanelInputValue('defaultWeight', localStorage.getItem(DEFAULT_WEIGHT_KEY) || '0.1');
  }

  function getDefaultSupplyPrice() {
    return getPanelInputValue('defaultSupplyPrice', localStorage.getItem(DEFAULT_SUPPLY_PRICE_KEY) || '');
  }

  function getDefaultSourcePrice() {
    const stored = localStorage.getItem(DEFAULT_SOURCE_PRICE_KEY) || '';
    if (positiveNumber(stored)) return stored;
    return getPanelInputValue('defaultSourcePrice', stored);
  }

  function getDefaultStock() {
    return '15';
  }

  function isExactPostageTemplate111Text(text) {
    return String(text || '').replace(/\s+/g, ' ').trim() === EDIT_PAGE_RULES.postageTemplateId;
  }

  function isExactPostageTemplate111OptionText(text, title = '') {
    const normalizedText = String(text || '').replace(/\s+/g, ' ').trim();
    const normalizedTitle = String(title || '').replace(/\s+/g, ' ').trim();
    if (normalizedText) return normalizedText === EDIT_PAGE_RULES.postageTemplateId;
    return normalizedTitle === EDIT_PAGE_RULES.postageTemplateId;
  }

  function getCommittedPostageTemplateText(container) {
    if (!container) return '';
    const nativeSelect = Array.from(container.querySelectorAll('select')).find(visibleElement);
    if (nativeSelect && nativeSelect.selectedOptions && nativeSelect.selectedOptions[0]) {
      return elementText(nativeSelect.selectedOptions[0]);
    }
    const info = getAntSelectValueInfo(container);
    return firstNonEmpty(info.selectedText, info.itemTitle, '');
  }

  function getDefaultShopId() {
    return getPanelInputValue('defaultShopId', localStorage.getItem(DEFAULT_SHOP_ID_KEY) || '8438115');
  }

  function getTaskExchangeRate() {
    return getPanelInputValue('taskExchangeRate', localStorage.getItem(TASK_EXCHANGE_RATE_KEY) || '7');
  }

  function getTaskPriceMultiplier() {
    return getPanelInputValue('taskPriceMultiplier', localStorage.getItem(TASK_PRICE_MULTIPLIER_KEY) || '1.55');
  }

  function getDefaultLengthIn() {
    return getPanelInputValue('defaultLengthIn', localStorage.getItem(DEFAULT_LENGTH_IN_KEY) || '');
  }

  function getDefaultWidthIn() {
    return getPanelInputValue('defaultWidthIn', localStorage.getItem(DEFAULT_WIDTH_IN_KEY) || '');
  }

  function getDefaultHeightIn() {
    return getPanelInputValue('defaultHeightIn', localStorage.getItem(DEFAULT_HEIGHT_IN_KEY) || '');
  }

  function getDefaultLength() {
    return getPanelInputValue('defaultLength', localStorage.getItem(DEFAULT_LENGTH_KEY) || '12.7');
  }

  function getDefaultWidth() {
    return getPanelInputValue('defaultWidth', localStorage.getItem(DEFAULT_WIDTH_KEY) || '12.7');
  }

  function getDefaultHeight() {
    return getPanelInputValue('defaultHeight', localStorage.getItem(DEFAULT_HEIGHT_KEY) || '1.27');
  }

  function getAmazonSourceAsin() {
    return getPanelInputValue('amazonAsin', localStorage.getItem(AMAZON_SOURCE_ASIN_KEY) || '');
  }
  const SAVE_FIELDS = [
    'shopId',
    'categoryId',
    'subject',
    'sourceUrl',
    'fullCid',
    'productPropertyListJson',
    'mainImageListJson',
    'imgUrl',
    'marketImage2',
    'marketImage1',
    'videoListJson',
    'optionValues',
    'optionValueIds',
    'shipFrom',
    'productUnit',
    'packageType',
    'lotNum',
    'supportCountrySupplyPrice',
    'variationListStr',
    'sizeChartId',
    'detailMobile',
    'detailWeb',
    'sizeChartIdListJson',
    'deliveryTime',
    'postageId',
    'aeopQualificationStructListJson',
    'manufactureId',
    'msrEuId',
    'msrTrId',
    'op',
    'id',
    'currencyCode',
    'dxmState',
    'productId',
  ];

  const REQUIRED_FIELDS = [
    'id',
    'shopId',
    'categoryId',
    'subject',
    'productPropertyListJson',
    'mainImageListJson',
    'variationListStr',
    'postageId',
    'deliveryTime',
    'detailMobile',
    'detailWeb',
  ];

  const DEFAULT_PROPERTY_LIST_BY_CATEGORY = {
    '200291142': [
      {
        attr_name_id: '2',
        attr_name: 'Brand Name',
        attr_value_id: '201512802',
        attr_value: 'None',
        attr_value_unit: null,
        attr_value_start: null,
        attr_value_end: null,
      },
      {
        attr_name_id: '400000603',
        attr_name: 'High-concerned chemical',
        attr_value_id: '23399591357',
        attr_value: '\u5929\u7136\u672a\u5904\u7406(None)',
      },
      {
        attr_name_id: '219',
        attr_name: 'Origin',
        attr_value_id: '9442295690',
        attr_value: '\u7f8e\u56fd(Origin)(US(Origin))',
        attr_value_unit: null,
        attr_value_start: null,
        attr_value_end: null,
      },
    ],
  };

  const CATEGORY_RESOLVER_AUTO_APPLY_CONFIDENCE = 0.85;
  const REQUIRE_ALIEXPRESS_CATEGORY_EVIDENCE = true;
  const CATEGORY_EVIDENCE_STATUS = {
    CLEAR: 'clear',
    SPLIT: 'split',
    MISSING: 'missing',
    UNAVAILABLE: 'unavailable',
  };
  // CATEGORY_RESOLVER_RULES is generated from skills/category-resolver/learned_rules.json.
  const CATEGORY_RESOLVER_RULES = [
      {
          "id": "pen-holders-visible-dxm",
          "status": "active",
          "type": "categoryMapping",
          "scope": "desk-stationery-storage-only",
          "categoryId": "",
          "categoryPath": "Office & School Supplies > Desk Accessories & Organizer > Pen Holders",
          "match": {
              "anyTitleTerms": [
                  "pen holder",
                  "pen holders",
                  "pencil holder",
                  "pencil holders",
                  "pencil cup",
                  "desk pen holder",
                  "desk pen organizer",
                  "rotating pen organizer",
                  "rotating pencil organizer",
                  "rotating pencil cup",
                  "rotating organizer for pencils",
                  "rotating organizer for office supplies",
                  "desktop stationery storage",
                  "桌面文具收纳",
                  "笔筒"
              ],
              "anySourceCategoryTerms": [
                  "pen holders",
                  "desk accessories",
                  "office supplies"
              ],
              "negativeTitleTerms": [
                  "cable organizer",
                  "makeup organizer",
                  "bathroom organizer",
                  "kitchen organizer",
                  "drawer organizer",
                  "clothing organizer",
                  "wardrobe organizer",
                  "letter organizer",
                  "file organizer"
              ]
          },
          "defaults": {},
          "visibleCategorySearchTerms": [
              "Pen Holders",
              "笔筒",
              "Pencil Holders",
              "Pencil Cup",
              "Desk Pen Holder"
          ],
          "principles": [
              "Amazon original category is only auxiliary and cannot be copied as the DXM category.",
              "DXM category must be judged by actual use, physical form, title semantics, and image content.",
              "Generic Organizer alone must not match Pen Holders.",
              "If Amazon category and DXM category differ but DXM category better matches actual use, use the DXM category."
          ],
          "evidence": [
              "manual confirmation 2026-06-25: DXM visible category path 办公、文化及教育用品 > 桌上收纳用品 > 笔筒(Pen Holders)"
          ]
      },
      {
          "id": "bumpers-200291142",
          "status": "active",
          "type": "categoryMapping",
          "scope": "cabinet-door-furniture-bumper-pads-only",
          "categoryId": "200291142",
          "categoryPath": "家装（硬装）(Home Improvement)/五金(Hardware)/家具五金(Furniture Hardware)/柜门消音垫(Cabinet Bumpers)",
          "match": {
              "anyTitleTerms": [
                  "bumper",
                  "bumpers",
                  "rubber bumper",
                  "cabinet bumper",
                  "cabinet bumpers",
                  "cabinet door bumper",
                  "cabinet door bumpers",
                  "clear cabinet door bumpers",
                  "self-adhesive silicone pads",
                  "sound-dampening protectors",
                  "door stopper",
                  "furniture pad",
                  "furniture pads",
                  "self adhesive bumper",
                  "self adhesive bumpers"
              ],
              "anySourceCategoryTerms": [
                  "cabinet bumpers",
                  "rubber bumpers",
                  "furniture hardware",
                  "hardware"
              ],
              "negativeTitleTerms": [
                  "car bumper",
                  "bumper case",
                  "phone bumper",
                  "baby bumper",
                  "crib bumper",
                  "wall hook",
                  "coat hook",
                  "sink strainer",
                  "soap dish"
              ]
          },
          "defaults": {
              "productPropertyListJson": [
                  {
                      "attr_name_id": "2",
                      "attr_name": "Brand Name",
                      "attr_value_id": "201512802",
                      "attr_value": "None",
                      "attr_value_unit": null,
                      "attr_value_start": null,
                      "attr_value_end": null
                  },
                  {
                      "attr_name_id": "400000603",
                      "attr_name": "High-concerned chemical",
                      "attr_value_id": "23399591357",
                      "attr_value": "天然未处理(None)"
                  },
                  {
                      "attr_name_id": "219",
                      "attr_name": "Origin",
                      "attr_value_id": "9442295690",
                      "attr_value": "美国(Origin)(US(Origin))",
                      "attr_value_unit": null,
                      "attr_value_start": null,
                      "attr_value_end": null
                  }
              ]
          },
          "visibleCategorySearchTerms": [
              "Cabinet Bumpers",
              "柜门消音垫",
              "Furniture Hardware",
              "家具五金",
              "Hardware"
          ],
          "principles": [
              "For self-adhesive silicone/rubber pads used on cabinet doors, drawers, furniture, walls, or door handles, prefer Cabinet Bumpers under Home Improvement > Hardware > Furniture Hardware.",
              "Do not use broad furniture pads if the exact Cabinet Bumpers leaf is visible.",
              "Do not mix cabinet bumpers with wall hooks, automotive bumpers, phone bumpers, or sink/bathroom products."
          ],
          "evidence": [
              "analysis/save-json-3/choiceSave.pretty.json",
              "2026-06-30 recovery: DXM visible category modal found 家装（硬装） > 五金 > 家具五金 > 柜门消音垫(Cabinet Bumpers) for B0GDRKKWRC"
          ]
      },
      {
          "id": "portable-soap-dishes-visible-dxm",
          "status": "active",
          "type": "categoryMapping",
          "scope": "bathroom-portable-soap-dish-only",
          "categoryId": "",
          "categoryPath": "家居用品(Home & Garden)/家居日用品(Home Products)/浴室用品(Bathroom Products)/便携肥皂盒（非安装，非金属）(Portable Soap Dishes)",
          "match": {
              "anyTitleTerms": [
                  "soap dish",
                  "soap dishes",
                  "soap holder",
                  "soap tray",
                  "soap saver",
                  "self draining soap dish",
                  "self draining sink organizer tray",
                  "silicone soap dish",
                  "portable soap dish",
                  "便携肥皂盒",
                  "肥皂盒"
              ],
              "anySourceCategoryTerms": [
                  "soap dishes",
                  "bathroom products",
                  "bathroom accessories"
              ],
              "negativeTitleTerms": [
                  "soap dispenser",
                  "liquid soap",
                  "bath basket",
                  "bathroom accessories set",
                  "soap box"
              ]
          },
          "defaults": {},
          "visibleCategorySearchTerms": [
              "浴室",
              "Bathroom Products",
              "Soap Dish",
              "Portable Soap Dishes",
              "便携肥皂盒"
          ],
          "principles": [
              "For non-mounted non-metal soap dishes and self-draining soap trays, prefer Portable Soap Dishes.",
              "Do not use Soap Box, Bath Baskets, or broad Bathroom Accessories Sets for this product family."
          ],
          "evidence": [
              "2026-06-30 live DXM v1.1.85 sample B0BPS66NC3 saved with category 便携肥皂盒（非安装，非金属）(Portable Soap Dishes)",
              "2026-06-30 20-category batch: B0DYZQHGM5 saved to wait-to-publish with category 便携肥皂盒（非安装，非金属）(Portable Soap Dishes), CNY 64.99, stock 15"
          ]
      },
      {
          "id": "drawer-organizer-storage-boxes-visible-dxm",
          "status": "active",
          "type": "categoryMapping",
          "scope": "desk-drawer-storage-trays-only",
          "categoryId": "",
          "categoryPath": "家居用品(Home & Garden)/家用储存收藏用具(Home Storage & Organization)/收纳盒和收纳箱(Storage Boxes & Bins)",
          "match": {
              "anyTitleTerms": [
                  "desk drawer organizer",
                  "drawer organizer tray",
                  "drawer organizer",
                  "desk organizer with drawers",
                  "office drawer organizer",
                  "stationery organizer tray",
                  "makeup drawer organizer",
                  "抽屉收纳盒",
                  "桌面收纳",
                  "收纳盒"
              ],
              "anySourceCategoryTerms": [
                  "storage boxes",
                  "storage bins",
                  "home storage",
                  "drawer organizer"
              ],
              "negativeTitleTerms": [
                  "pen holder",
                  "cable organizer",
                  "soap dish",
                  "sink strainer",
                  "wall hook"
              ]
          },
          "defaults": {},
          "visibleCategorySearchTerms": [
              "Storage Boxes & Bins",
              "收纳盒和收纳箱",
              "Home Storage & Organization",
              "Storage Boxes",
              "收纳盒",
              "Drawer Organizers",
              "Home Storage"
          ],
          "principles": [
              "For desk/drawer organizer trays used for office, stationery, makeup, or home storage, prefer Storage Boxes & Bins when no more specific visible office category exists.",
              "Search the exact leaf text Storage Boxes & Bins / 收纳盒和收纳箱 before broad 收纳盒, because broad 收纳盒 can incorrectly hit 电池收纳盒(Battery Storage Boxes).",
              "Do not map pen cups, cable organizers, soap dishes, sink strainers, wall hooks, or battery storage boxes into this category."
          ],
          "evidence": [
              "2026-06-30 20-category recovery: B0DQ3X91R7 verified as desk/drawer organizer storage; DXM visible category selected 收纳盒和收纳箱(Storage Boxes & Bins)."
          ]
      },
      {
          "id": "qtip-makeup-organizers-visible-dxm",
          "status": "active",
          "type": "categoryMapping",
          "scope": "cotton-swab-bathroom-vanity-organizer-only",
          "categoryId": "",
          "categoryPath": "家居用品(Home & Garden)/家用储存收藏用具(Home Storage & Organization)/浴室收纳(非五金材质，非打孔安装）(Bathroom Storage & Organization)/化妆品收纳盒(Makeup Organizers)",
          "match": {
              "anyTitleTerms": [
                  "qtip holder",
                  "q-tip holder",
                  "cotton swab holder",
                  "cotton swab dispenser",
                  "cotton balls pads floss picks",
                  "bathroom vanity organizer",
                  "makeup storage organizer",
                  "apothecary jar",
                  "棉签盒",
                  "化妆品收纳盒"
              ],
              "anySourceCategoryTerms": [
                  "makeup organizers",
                  "bathroom storage",
                  "home storage"
              ],
              "negativeTitleTerms": [
                  "kitchen utensil holder",
                  "paper towel holder",
                  "toothbrush holder",
                  "shower caddy",
                  "drawer organizer tray"
              ]
          },
          "defaults": {},
          "visibleCategorySearchTerms": [
              "化妆品收纳盒",
              "Makeup Organizers",
              "Bathroom Storage & Organization",
              "棉签盒",
              "Bathroom Storage",
              "Vanity Organizer"
          ],
          "principles": [
              "For acrylic cotton swab, cotton ball, floss pick, and vanity jar organizers, prefer Makeup Organizers under Bathroom Storage & Organization.",
              "Search 化妆品收纳盒 / Makeup Organizers before 棉签盒 when selecting DXM visible categories, because 棉签盒 may return no exact visible category even when Makeup Organizers exists.",
              "Do not map kitchen, paper towel, toothbrush, shower, or generic drawer organizers into this category."
          ],
          "evidence": [
              "2026-06-30 20-category recovery: B08PB79YXV verified as cotton-swab/bathroom vanity makeup organizer; DXM visible category selected 化妆品收纳盒(Makeup Organizers)."
          ]
      },
      {
          "id": "silicone-trivet-placemats-adjacent-dxm",
          "status": "active",
          "type": "categoryMapping",
          "scope": "silicone-trivet-pot-holder-hot-pad-only",
          "categoryId": "",
          "categoryPath": "家居用品(Home & Garden)/家纺成品(Home Textile)/餐桌布艺(Table Linen)/餐垫(Placemats)",
          "match": {
              "anyTitleTerms": [
                  "silicone pot holder",
                  "silicone pot holders",
                  "pot holder",
                  "pot holders",
                  "hot pad",
                  "hot pads",
                  "trivet",
                  "trivets",
                  "silicone trivet",
                  "silicone trivet mat",
                  "heat resistant mat",
                  "heat resistant pads",
                  "kitchen trivet",
                  "jar opener",
                  "spoon rest",
                  "隔热垫",
                  "锅垫",
                  "防烫垫",
                  "餐垫"
              ],
              "anySourceCategoryTerms": [
                  "pot holders",
                  "trivets",
                  "hot pads",
                  "kitchen mats",
                  "placemats",
                  "table linen"
              ],
              "negativeTitleTerms": [
                  "teapot",
                  "tea pot",
                  "coaster set",
                  "cup coaster",
                  "placemat set",
                  "tablecloth",
                  "oven mitt",
                  "glove",
                  "tea warmer"
              ]
          },
          "defaults": {},
          "visibleCategorySearchTerms": [
              "餐垫",
              "Placemats",
              "Table Linen",
              "Home Textile",
              "家纺成品"
          ],
          "principles": [
              "AliExpress evidence only constrains the product family; Dianxiaomi does not need the exact same leaf text when no exact Pot Holders/Trivets category is visible.",
              "For flat silicone heat-resistant pot holders, hot pads, and trivets, use the safe adjacent Placemats category when exact 隔热垫/锅垫/Pot Holders/Trivets searches are unavailable in Dianxiaomi.",
              "Prefer 餐垫(Placemats) over 杯垫(Coaster) or 茶壶底座(Teapot Trivets) unless the product is clearly cup-only or teapot-only."
          ],
          "evidence": [
              "2026-07-01 recovery: B0DFPHVNHG AliExpress evidence showed silicone heat-resistant trivet mat / pot holder / hot pad family; DXM exact searches 隔热垫, 锅垫, Pot Holders did not expose a safe exact leaf, while 餐垫(Placemats) was visible as a safe adjacent table-linen category."
          ]
      },
      {
          "id": "coat-hooks-visible-dxm",
          "status": "active",
          "type": "categoryMapping",
          "scope": "adhesive-wall-heavy-duty-hooks-only",
          "categoryId": "",
          "categoryPath": "家居用品(Home & Garden)/家用储存收藏用具(Home Storage & Organization)/钩子和导轨(Hooks & Rails)/衣帽挂钩(Coat Hooks)",
          "match": {
              "anyTitleTerms": [
                  "coat hook",
                  "coat hooks",
                  "wall hook",
                  "wall hooks",
                  "adhesive hook",
                  "adhesive hooks",
                  "heavy duty hook",
                  "heavy duty hooks",
                  "hooks for hanging",
                  "wall hangers without nails",
                  "衣帽挂钩",
                  "挂钩"
              ],
              "anySourceCategoryTerms": [
                  "hooks",
                  "hooks & rails",
                  "home storage"
              ],
              "negativeTitleTerms": [
                  "cable",
                  "wire",
                  "fishing hook",
                  "carabiner",
                  "faucet"
              ]
          },
          "defaults": {},
          "visibleCategorySearchTerms": [
              "挂钩",
              "Hooks",
              "Coat Hooks",
              "Wall Hooks",
              "Hooks & Rails"
          ],
          "principles": [
              "For adhesive heavy-duty wall hooks or no-nail wall hangers, prefer Coat Hooks under Hooks & Rails.",
              "Do not mix wall hooks with cable organizers or faucet hardware."
          ],
          "evidence": [
              "2026-06-30 remaining batch: B09PFW8WRQ saved to wait-to-publish with category 衣帽挂钩(Coat Hooks)",
              "2026-06-30 20-category batch: B0FWKSDJZ5 saved to wait-to-publish with category 衣帽挂钩(Coat Hooks), CNY 64.99, stock 15"
          ]
      },
      {
          "id": "cable-organizers-visible-dxm",
          "status": "active",
          "type": "categoryMapping",
          "scope": "desktop-office-adhesive-cable-holder-only",
          "categoryId": "",
          "categoryPath": "办公、文化及教育用品(Office & School Supplies)/桌上收纳用品(Desk Accessories & Organizer)/桌面理线器(Cable Organizers)",
          "match": {
              "anyTitleTerms": [
                  "cable holder",
                  "cable holders",
                  "cord holder",
                  "cord holders",
                  "wire holder",
                  "wire holders",
                  "cable clip",
                  "cable clips",
                  "wire clip",
                  "wire clips",
                  "cord organizer",
                  "cord organizers",
                  "cable organizer",
                  "cable organizers",
                  "wire management",
                  "cord management",
                  "desk cable organizer",
                  "adhesive cable clips",
                  "self adhesive cable clips",
                  "桌面理线器",
                  "理线器",
                  "理线夹",
                  "线夹"
              ],
              "anySourceCategoryTerms": [
                  "cable management",
                  "desk accessories",
                  "office supplies"
              ],
              "negativeTitleTerms": [
                  "conductive",
                  "glue paste",
                  "conductive wire glue",
                  "electrical cable tool",
                  "wire crimping",
                  "network cabling tool",
                  "导电线胶膏",
                  "线缆工具"
              ]
          },
          "defaults": {},
          "visibleCategorySearchTerms": [
              "办公",
              "Office & School Supplies",
              "Desk Accessories",
              "Cable Organizers",
              "桌面理线器"
          ],
          "principles": [
              "For adhesive cable clips used on desks, nightstands, offices, mouse/charger cables, prefer Desk Accessories > Cable Organizers.",
              "Do not use Cable Tools when the product is a passive adhesive desk cable holder rather than a tool.",
              "Do not use Conductive Wire Glue Pastes for physical cable clips."
          ],
          "evidence": [
              "2026-06-30 live DXM edit recovery for B0CNSYPZBQ selected 桌面理线器(Cable Organizers) and saved to wait-to-publish",
              "runs/category-resolver/20260630-remaining3-poc/B0CNSYPZBQ.resolver.json"
          ]
      },
      {
          "id": "kitchen-drains-strainers-200231151",
          "status": "active",
          "type": "categoryMapping",
          "scope": "kitchen-sink-drain-strainer-only",
          "categoryId": "200231151",
          "categoryPath": "家装（硬装）(Home Improvement)/厨房设施(Kitchen Fixture)/厨房水槽配件(Kitchen Sink Accessories)/厨房水槽水漏、过滤网(Kitchen Drains & Strainers)",
          "match": {
              "anyTitleTerms": [
                  "sink strainer",
                  "sink strainers",
                  "kitchen sink strainer",
                  "sink drain strainer",
                  "drain strainer",
                  "drain basket",
                  "sink stopper",
                  "sink drain stopper",
                  "sink filter",
                  "水槽滤网",
                  "水槽过滤",
                  "水槽下水"
              ],
              "anySourceCategoryTerms": [
                  "kitchen sink accessories",
                  "drains & strainers",
                  "kitchen drains & strainers"
              ],
              "negativeTitleTerms": [
                  "faucet",
                  "sprayer",
                  "pump",
                  "commercial kitchen appliance",
                  "electric appliance",
                  "soap dish"
              ]
          },
          "defaults": {
              "productPropertyListJson": [
                  {
                      "attr_name_id": "2",
                      "attr_name": "Brand Name",
                      "attr_value_id": "201512802",
                      "attr_value": "NONE",
                      "attr_value_unit": null,
                      "attr_value_start": null,
                      "attr_value_end": null
                  },
                  {
                      "attr_name_id": "400000603",
                      "attr_name": "High-concerned chemical",
                      "attr_value_id": "23399591357",
                      "attr_value": "天然未处理(None)"
                  },
                  {
                      "attr_name_id": "219",
                      "attr_name": "Origin",
                      "attr_value_id": "9442295690",
                      "attr_value": "美国(Origin)(US(Origin))",
                      "attr_value_unit": null,
                      "attr_value_start": null,
                      "attr_value_end": null
                  }
              ]
          },
          "visibleCategorySearchTerms": [
              "水槽",
              "Sink",
              "Drain",
              "Strainer",
              "厨房水槽水漏、过滤网",
              "Kitchen Drains & Strainers"
          ],
          "principles": [],
          "evidence": [
              "runs/category-resolver/20260630-remaining3-poc/B0D65JFRX4.resolver.json",
              "runs/category-resolver/20260630-remaining3-poc/summary.md",
              "runs/op1-20260624-011902/20260624-011902-50169732817/dry-run-report.json",
              "2026-06-30 20-category batch: B0B4QZD77M saved to wait-to-publish with category 厨房水槽水漏、过滤网(Kitchen Drains & Strainers), CNY 63.91, stock 15"
          ]
      }
  ];

  const US_SHIPS_FROM_PROPERTY = {
    sku_property_id: '200007763',
    sku_property_name: 'Ships From',
    property_value_id: '201336106',
    sku_property_value: 'United States',
    property_value_definition_name: '',
    sku_image: '',
  };

  function normalizeCategoryText(value) {
    return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function getRuleProperties(rule) {
    const defaults = rule && rule.defaults ? rule.defaults : {};
    return Array.isArray(defaults.productPropertyListJson) ? defaults.productPropertyListJson : null;
  }

  function getCategoryPropertiesById(categoryId) {
    if (DEFAULT_PROPERTY_LIST_BY_CATEGORY[categoryId]) return DEFAULT_PROPERTY_LIST_BY_CATEGORY[categoryId];
    const rule = CATEGORY_RESOLVER_RULES.find((item) => item.status === 'active' && String(item.categoryId) === String(categoryId));
    return getRuleProperties(rule);
  }

  function countMatchedTerms(haystack, terms) {
    const matched = [];
    for (const term of terms || []) {
      const normalized = normalizeCategoryText(term);
      if (normalized && haystack.includes(normalized)) matched.push(term);
    }
    return matched;
  }

  function scoreCategoryRule(rule, haystack, asin) {
    const match = rule.match || {};
    const exactAsins = (match.exactAsins || []).map((item) => String(item).toUpperCase());
    if (asin && exactAsins.includes(String(asin).toUpperCase())) {
      return { confidence: 1, matchedTerms: [`asin:${asin}`] };
    }

    const titleMatches = countMatchedTerms(haystack, match.anyTitleTerms || []);
    const sourceMatches = countMatchedTerms(haystack, match.anySourceCategoryTerms || []);
    let confidence = 0;
    if (titleMatches.length) confidence += Math.min(0.72, 0.38 + titleMatches.length * 0.11);
    if (sourceMatches.length) confidence += Math.min(0.38, 0.2 + sourceMatches.length * 0.09);
    confidence = Math.min(0.98, confidence);
    return {
      confidence,
      matchedTerms: [...titleMatches, ...sourceMatches],
    };
  }

  function ruleHasNegativeCategorySignal(rule, haystack) {
    const match = rule && rule.match ? rule.match : {};
    return (match.negativeTitleTerms || []).some((term) => {
      const normalized = normalizeCategoryText(term);
      return normalized && haystack.includes(normalized);
    });
  }

  function getActiveVisibleCategoryRules() {
    return CATEGORY_RESOLVER_RULES.filter((rule) => (
      rule.status === 'active'
      && Array.isArray(rule.evidence)
      && rule.evidence.length
      && Array.isArray(rule.visibleCategorySearchTerms)
      && rule.visibleCategorySearchTerms.length
      && rule.categoryPath
    ));
  }

  function buildCategoryEvidenceFromRule(rule, extra = {}) {
    return {
      status: CATEGORY_EVIDENCE_STATUS.CLEAR,
      source: 'success_verified_or_aliexpress_learned_rule',
      ruleId: rule && rule.id ? rule.id : '',
      categoryPath: rule && rule.categoryPath ? rule.categoryPath : '',
      candidateCategories: rule && rule.categoryPath ? [rule.categoryPath] : [],
      dxmSearchTerms: rule && Array.isArray(rule.visibleCategorySearchTerms) ? rule.visibleCategorySearchTerms : [],
      evidence: rule && Array.isArray(rule.evidence) ? rule.evidence : [],
      matchedTerms: extra.matchedTerms || [],
      confidence: extra.confidence || 0,
    };
  }

  function buildMissingCategoryEvidence(titleText, currentCategoryText = '') {
    return {
      status: CATEGORY_EVIDENCE_STATUS.MISSING,
      source: 'missing',
      title: String(titleText || '').trim(),
      currentCategoryText: String(currentCategoryText || '').trim(),
      candidateCategories: [],
      dxmSearchTerms: [],
      evidence: [],
      legalNextStep: 'run_aliexpress_category_verification',
      failureReason: 'category_evidence_missing',
    };
  }

  function readAliExpressEvidenceStore() {
    const rawSources = [
      typeof window !== 'undefined' ? window.__DXM_ALIEXPRESS_EVIDENCE_STORE__ : null,
      localStorage.getItem(ALIEXPRESS_EVIDENCE_STORE_KEY),
      document.getElementById('dxm-aliexpress-evidence-store-json')?.textContent || '',
    ].filter((value) => value !== undefined && value !== null && value !== '');
    for (const raw of rawSources) {
      const store = parseMaybeJson(raw, null);
      if (
        store
        && store.schemaVersion === ALIEXPRESS_EVIDENCE_STORE_SCHEMA_VERSION
        && store.records
        && typeof store.records === 'object'
        && !Array.isArray(store.records)
      ) {
        return { ok: true, store };
      }
    }
    return {
      ok: false,
      reason: `AliExpress evidence store missing in localStorage key ${ALIEXPRESS_EVIDENCE_STORE_KEY}`,
    };
  }

  function getCurrentEditAsinForEvidence(titleText = '', product = null) {
    const sourceProduct = product || getProductFromEdit(state.editData) || {};
    return extractAsin([
      sourceProduct.sourceUrl,
      sourceProduct.url,
      extractSourceUrlFromCurrentEditPage(),
      sourceProduct.asin,
      sourceProduct.sourceId,
      sourceProduct.platformProductId,
      sourceProduct.subject,
      titleText,
      getAmazonSourceAsin(),
      location.href,
    ].filter(Boolean).join(' '));
  }

  function getAliExpressEvidenceRecordForAsin(asin) {
    const normalizedAsin = extractAsin(asin);
    if (!normalizedAsin) return { ok: false, reason: 'missing_asin_for_evidence_lookup', asin: '' };
    const storeStatus = readAliExpressEvidenceStore();
    if (!storeStatus.ok) return { ok: false, reason: storeStatus.reason, asin: normalizedAsin };
    const record = storeStatus.store.records[normalizedAsin] || null;
    if (!record) return { ok: false, reason: 'category_evidence_missing', asin: normalizedAsin, storeUpdatedAt: storeStatus.store.updatedAt || '' };
    return { ok: true, asin: normalizedAsin, record, storeUpdatedAt: storeStatus.store.updatedAt || '' };
  }

  function isVerifiedAliExpressEvidenceStatus(status) {
    return status === 'aliexpress_verified' || status === 'conditional_verified' || status === 'detail_verified' || status === 'learned_rule_matched';
  }

  function getAliExpressDxmSearchTerms(record) {
    return [];
  }

  function isAliExpressEvidenceUsableForDxmAutoMapping(record) {
    if (!record) return false;
    return Boolean(
      isVerifiedAliExpressEvidenceStatus(record.status)
      && String(record.dxmCandidateCategory || '').trim()
    );
  }

  function getAliExpressEvidencePreflightStatus(titleText = '', currentCategoryText = '') {
    const product = getProductFromEdit(state.editData) || {};
    const asin = getCurrentEditAsinForEvidence(titleText, product);
    const found = getAliExpressEvidenceRecordForAsin(asin);
    const base = {
      required: REQUIRE_ALIEXPRESS_CATEGORY_EVIDENCE,
      cacheKey: ALIEXPRESS_EVIDENCE_STORE_KEY,
      asin,
      currentCategoryText: String(currentCategoryText || '').trim(),
    };
    if (!found.ok) return { ...base, ok: false, reason: found.reason, storeUpdatedAt: found.storeUpdatedAt || '' };
    const record = found.record || {};
    const dxmCandidateCategory = String(record.dxmCandidateCategory || '').trim();
    const detailUniqueCategoryConfirmed = Boolean(record.aliexpressUniqueCategoryConfirmed || record.aliexpressDetailCategoryPath || record.aliexpressCategoryId);
    if (detailUniqueCategoryConfirmed && !dxmCandidateCategory) {
      return {
        ...base,
        ok: false,
        reason: 'aliexpress_category_confirmed_but_dxm_mapping_missing',
        recordStatus: record.status || '',
        recordSource: record.source || '',
        aliexpressCategoryId: String(record.aliexpressCategoryId || '').trim(),
        aliexpressMatchedCategory: String(record.aliexpressMatchedCategory || '').trim(),
        aliexpressDetailCategoryName: String(record.aliexpressDetailCategoryName || '').trim(),
        aliexpressDetailCategoryPath: String(record.aliexpressDetailCategoryPath || '').trim(),
        storeUpdatedAt: found.storeUpdatedAt || '',
      };
    }
    if (!isAliExpressEvidenceUsableForDxmAutoMapping(record)) {
      return {
        ...base,
        ok: false,
        reason: `AliExpress evidence is not usable for DXM auto mapping: ${record.status || 'missing'}`,
        recordStatus: record.status || '',
        recordSource: record.source || '',
        storeUpdatedAt: found.storeUpdatedAt || '',
      };
    }
    const dxmSearchTerms = getAliExpressDxmSearchTerms(record);
    if (!dxmCandidateCategory) {
      return {
        ...base,
        ok: false,
        reason: 'aliexpress_category_confirmed_but_dxm_mapping_missing',
        recordStatus: record.status || '',
        recordSource: record.source || '',
        aliexpressCategoryId: String(record.aliexpressCategoryId || '').trim(),
        aliexpressMatchedCategory: String(record.aliexpressMatchedCategory || '').trim(),
        aliexpressDetailCategoryName: String(record.aliexpressDetailCategoryName || '').trim(),
        aliexpressDetailCategoryPath: String(record.aliexpressDetailCategoryPath || '').trim(),
        storeUpdatedAt: found.storeUpdatedAt || '',
      };
    }
    return {
      ...base,
      ok: true,
      reason: '',
      recordStatus: record.status,
      recordSource: record.source || '',
      safeAdjacentUsed: Boolean(record.safeAdjacentUsed),
      dxmCandidateCategory,
      dxmSearchTerms,
      dxmAutoMappingRequired: !dxmCandidateCategory && dxmSearchTerms.length > 0,
      aliexpressMatchedCategory: String(record.aliexpressMatchedCategory || '').trim(),
      aliexpressCategoryId: String(record.aliexpressCategoryId || '').trim(),
      evidenceSummary: String(record.evidenceSummary || record.reason || '').trim(),
      storeUpdatedAt: found.storeUpdatedAt || '',
      updatedAt: record.updatedAt || '',
    };
  }

  function buildCategoryEvidenceFromAliExpressRecord(asin, record, extra = {}) {
    const dxmSearchTerms = getAliExpressDxmSearchTerms(record);
    const categoryPath = String(record.dxmCandidateCategory || '').trim();
    return {
      status: CATEGORY_EVIDENCE_STATUS.CLEAR,
      source: 'asin_aliexpress_evidence_store',
      asin,
      recordStatus: record.status || '',
      recordSource: record.source || '',
      safeAdjacentUsed: Boolean(record.safeAdjacentUsed),
      categoryPath,
      candidateCategories: [
        record.dxmCandidateCategory,
        record.aliexpressMatchedCategory,
      ].map((item) => String(item || '').trim()).filter(Boolean),
      dxmSearchTerms,
      dxmAutoMappingRequired: !categoryPath && dxmSearchTerms.length > 0,
      platformCategoryConfirmed: Boolean(record.platformCategoryConfirmed),
      platformCategoryIntent: String(record.platformCategoryIntent || '').trim(),
      platformCategoryTerms: Array.isArray(record.platformCategoryTerms)
        ? record.platformCategoryTerms.map((item) => String(item || '').trim()).filter(Boolean)
        : [],
      aliexpressCategoryId: String(record.aliexpressCategoryId || '').trim(),
      aliexpressEvidenceUrl: String(record.aliexpressEvidenceUrl || '').trim(),
      evidence: [
        record.evidenceSummary,
        record.reason,
        record.aliexpressEvidenceUrl,
      ].map((item) => String(item || '').trim()).filter(Boolean),
      matchedTerms: extra.matchedTerms || [],
      confidence: extra.confidence || 1,
    };
  }

  function buildCategoryModalPlanFromAliExpressEvidenceStore(titleText, product = {}) {
    const asin = getCurrentEditAsinForEvidence(titleText, product);
    const found = getAliExpressEvidenceRecordForAsin(asin);
    if (!found.ok) return null;
    const record = found.record || {};
    if (!isAliExpressEvidenceUsableForDxmAutoMapping(record)) return null;
    const candidatePath = String(record.dxmCandidateCategory || '').trim();
    if (!candidatePath) return null;
    const pathTerms = splitCategoryPathTerms(candidatePath);
    const leaf = pathTerms[pathTerms.length - 1] || candidatePath || '';
    const topTerms = [
      pathTerms[0],
      leaf,
      candidatePath,
    ];
    const columnTerms = [
      ...pathTerms,
    ];
    const leafTerms = buildStrictDxmLeafTerms(leaf);
    return {
      id: `asin-evidence-${asin}`,
      source: 'asin-aliexpress-evidence-store',
      asin,
      categoryEvidence: buildCategoryEvidenceFromAliExpressRecord(asin, record),
      dxmAutoMappingRequired: false,
      exactDxmOnly: false,
      strictDxmCandidateOnly: true,
      expectedCategoryPath: candidatePath,
      evidence: [
        record.evidenceSummary,
        record.reason,
        record.aliexpressEvidenceUrl,
      ].map((item) => String(item || '').trim()).filter(Boolean),
      topTerms: [...new Set(topTerms.map((item) => String(item || '').trim()).filter(Boolean))],
      columnTerms: [...new Set(columnTerms.map((item) => String(item || '').trim()).filter(Boolean))],
      leafTerms: [...new Set(leafTerms.map((item) => String(item || '').trim()).filter(Boolean))],
      rejectTerms: [
        'Conductive Wire Glue Pastes',
        '\u5bfc\u7535\u7ebf\u80f6\u818f',
        'Cable Tools',
        '\u7ebf\u7f06\u5de5\u5177',
      ],
    };
  }

  function splitCategoryPathTerms(pathText) {
    return String(pathText || '')
      .split(/[/>]/)
      .map((item) => item.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  }

  function isGenericDxmAutoMappingLeafTerm(term) {
    const text = normalizeCategoryText(term);
    if (!text) return true;
    return /\baccessories\b|\bparts\b|\bfittings\b|\bkitchen\s+sink\s+accessories\b|\bfaucet\s+accessories\b|\bsink\s+accessories\b|\u914d\u4ef6|\u53a8\u623f\u6c34\u69fd|\u6c34\u69fd\u914d\u4ef6|\u6c34\u9f99\u5934\u914d\u4ef6/i.test(text);
  }

  function getDxmAutoMappingLeafTerms(dxmSearchTerms) {
    const precise = (dxmSearchTerms || [])
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .filter((item) => !isGenericDxmAutoMappingLeafTerm(item));
    return precise.length ? precise : [];
  }

  function getDxmAutoMappingRejectTerms(dxmSearchTerms) {
    const context = normalizeCategoryText((dxmSearchTerms || []).join(' '));
    const terms = [];
    const push = (value) => {
      const text = String(value || '').trim();
      if (text && !terms.some((item) => item.toLowerCase() === text.toLowerCase())) terms.push(text);
    };
    if (/\bfaucet\s+mat\b|\bsink\s+splash\s+guard\b|\bfaucet\s+splash\b|\u6c34\u9f99\u5934.{0,12}\u9632\u6e85|\u6c34\u69fd.{0,12}(\u9632\u6e85|\u63a5\u6c34)/i.test(context)) {
      [
        'Glass Rinser',
        'Cup Rinser',
        'Cup Washer',
        'Bottle Washer',
        '\u676f\u6d17\u5668',
        '\u6d17\u676f\u5668',
        '\u6d17\u74f6\u5668',
        'Drain Augers',
        'Drain Auger',
        'Drain Snake',
        'Drain Cleaning Tools',
        'Kitchen Drains & Strainers',
        'Kitchen Drains',
        'Sink Strainer',
        'Drain Strainer',
        'Sink Stopper',
        'Sink Plug',
        '\u6392\u6c34\u87ba\u65cb\u5668',
        '\u6392\u6c34\u87ba\u65cb',
        '\u7ba1\u9053\u758f\u901a',
        '\u6c34\u69fd\u6c34\u6f0f',
        '\u6c34\u6f0f',
        '\u8fc7\u6ee4\u7f51',
        '\u6ee4\u7f51',
      ].forEach(push);
    }
    return terms;
  }

  function getLeafTermsFromCategoryRule(rule) {
    const pathTerms = splitCategoryPathTerms(rule.categoryPath || '');
    const leaf = pathTerms[pathTerms.length - 1] || '';
    const terms = [
      leaf,
      ...(rule.visibleCategorySearchTerms || []),
      ...((rule.match && rule.match.anySourceCategoryTerms) || []),
    ];
    return [...new Set(terms.map((item) => String(item || '').trim()).filter(Boolean))];
  }

  function buildCategoryModalPlanFromRule(rule) {
    const pathTerms = splitCategoryPathTerms(rule.categoryPath || '');
    const leafTerms = getLeafTermsFromCategoryRule(rule);
    const topTerms = [
      ...(rule.visibleCategorySearchTerms || []),
      pathTerms[0],
      leafTerms[0],
    ].filter(Boolean);
    const rejectTerms = [
      ...((rule.match && rule.match.negativeTitleTerms) || []),
      'Conductive Wire Glue Pastes',
      '\u5bfc\u7535\u7ebf\u80f6\u818f',
      'Cable Tools',
      '\u7ebf\u7f06\u5de5\u5177',
    ];
    return {
      id: rule.id,
      source: 'aliexpress-evidence-learned-rule',
      categoryEvidence: buildCategoryEvidenceFromRule(rule),
      evidence: rule.evidence || [],
      topTerms: [...new Set(topTerms.map((item) => String(item || '').trim()).filter(Boolean))],
      columnTerms: [...new Set([...pathTerms, ...(rule.visibleCategorySearchTerms || [])].map((item) => String(item || '').trim()).filter(Boolean))],
      leafTerms,
      rejectTerms: [...new Set(rejectTerms.map((item) => String(item || '').trim()).filter(Boolean))],
    };
  }

  function buildCategoryModalPlanFromEvidence(titleText, product = {}) {
    const haystack = normalizeCategoryText([
      titleText,
      product.subject,
      product.title,
      product.productTitle,
      product.categoryName,
      product.categoryNameZh,
      product.sourceCategoryName,
      product.sourceCategoryNameZh,
      product.sourceUrl,
    ].filter(Boolean).join(' '));
    let best = null;
    for (const rule of getActiveVisibleCategoryRules()) {
      if (ruleHasNegativeCategorySignal(rule, haystack)) continue;
      const scored = scoreCategoryRule(rule, haystack, extractAsin(haystack));
      if (!scored.matchedTerms.length) continue;
      const confidence = Math.min(0.99, scored.confidence + 0.08);
      if (!best || confidence > best.confidence) {
        best = { rule, confidence, matchedTerms: scored.matchedTerms };
      }
    }
    if (!best || best.confidence < 0.72) return null;
    const plan = buildCategoryModalPlanFromRule(best.rule);
    plan.confidence = best.confidence;
    plan.matchedTerms = best.matchedTerms;
    plan.categoryEvidence = buildCategoryEvidenceFromRule(best.rule, {
      confidence: best.confidence,
      matchedTerms: best.matchedTerms,
    });
    return plan;
  }

  function resolveCategoryForProduct(payload, product) {
    const existingProperties = getCategoryPropertiesById(payload.categoryId);
    if (existingProperties) {
      const directRule = CATEGORY_RESOLVER_RULES.find((item) => item.status === 'active' && String(item.categoryId) === String(payload.categoryId));
      return {
        status: 'resolved',
        source: 'existing_category',
        publishCategoryId: payload.categoryId,
        categoryPath: directRule ? directRule.categoryPath : '',
        properties: existingProperties,
        confidence: 1,
        ruleId: directRule ? directRule.id : `category-${payload.categoryId}`,
        matchedTerms: [String(payload.categoryId)],
      };
    }

    const asin = extractAsin(`${product.sourceUrl || ''} ${product.sourceId || ''} ${product.platformProductId || ''} ${payload.sourceUrl || ''} ${payload.subject || ''}`);
    const haystack = normalizeCategoryText(
      [
        payload.categoryId,
        payload.fullCid,
        payload.subject,
        payload.sourceUrl,
        product.categoryName,
        product.categoryNameZh,
        product.sourceCategoryId,
        product.platformCategoryId,
        product.sourceCategoryName,
      ].join(' ')
    );
    let best = null;
    for (const rule of CATEGORY_RESOLVER_RULES.filter((item) => item.status === 'active')) {
      const scored = scoreCategoryRule(rule, haystack, asin);
      if (!best || scored.confidence > best.confidence) {
        best = { rule, ...scored };
      }
    }
    if (best && best.confidence >= CATEGORY_RESOLVER_AUTO_APPLY_CONFIDENCE) {
      return {
        status: 'resolved',
        source: 'learned_rules',
        publishCategoryId: String(best.rule.categoryId),
        categoryPath: best.rule.categoryPath || '',
        properties: getRuleProperties(best.rule),
        confidence: best.confidence,
        ruleId: best.rule.id,
        matchedTerms: best.matchedTerms,
      };
    }
    return {
      status: 'unresolved',
      source: 'manual_learning_required',
      publishCategoryId: '',
      categoryPath: '',
      properties: null,
      confidence: best ? best.confidence : 0,
      ruleId: best && best.rule ? best.rule.id : '',
      matchedTerms: best ? best.matchedTerms : [],
    };
  }

  function getDefaultPropertiesForProduct(payload, product) {
    return resolveCategoryForProduct(payload, product || {});
  }

  function isNumericPublishCategoryId(value) {
    return /^\d+$/.test(String(value || ''));
  }

  function walkJson(root, visit, maxDepth = 8) {
    const queue = [{ value: root, depth: 0 }];
    const seen = new Set();
    while (queue.length) {
      const item = queue.shift();
      const value = item.value;
      if (!value || typeof value !== 'object' || item.depth > maxDepth) continue;
      if (seen.has(value)) continue;
      seen.add(value);
      visit(value);
      if (Array.isArray(value)) {
        for (const child of value) queue.push({ value: child, depth: item.depth + 1 });
      } else {
        for (const child of Object.values(value)) queue.push({ value: child, depth: item.depth + 1 });
      }
    }
  }

  function firstObjectString(object, keys) {
    for (const key of keys) {
      if (object && object[key] !== undefined && object[key] !== null && String(object[key]).trim() !== '') {
        return String(object[key]).trim();
      }
    }
    return '';
  }

  function collectCategoryCandidates(json) {
    const candidates = [];
    const seen = new Set();
    walkJson(json, (object) => {
      if (Array.isArray(object)) return;
      const categoryId = firstObjectString(object, ['categoryId', 'cateId', 'id']);
      const categoryName = firstObjectString(object, ['categoryName', 'name', 'categoryNameEn', 'title']);
      if (!isNumericPublishCategoryId(categoryId) || !categoryName) return;
      const key = `${categoryId}|${categoryName}`;
      if (seen.has(key)) return;
      seen.add(key);
      candidates.push({
        categoryId,
        categoryName,
        categoryParentId: firstObjectString(object, ['categoryParentId', 'parentId', 'pid']),
        categoryPath: firstObjectString(object, ['nodePath', 'categoryPath', 'path', 'fullName', 'fullPath']),
        isLeaf: String(firstObjectString(object, ['isLeaf', 'leaf'])) === '1' || object.isLeaf === true || object.leaf === true,
        raw: object,
      });
    });
    return candidates;
  }

  const CATEGORY_SEARCH_STOP_WORDS = new Set([
    'the', 'and', 'for', 'with', 'from', 'into', 'onto', 'this', 'that', 'these', 'those', 'your', 'our',
    'men', 'women', 'kids', 'baby', 'new', 'set', 'pack', 'piece', 'pieces', 'pcs', 'pc', 'of', 'to', 'in',
    'a', 'an', 'by', 'on', 'as', 'at', 'or', 'mini', 'portable', 'rechargeable', 'powerful', 'personal',
  ]);

  function tokenizeCategoryTitle(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .map((item) => item.trim())
      .filter((item) => item && item.length > 2 && !CATEGORY_SEARCH_STOP_WORDS.has(item) && !/^\d+$/.test(item));
  }

  function rawCategoryTitleTokens(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .map((item) => item.trim())
      .filter((item) => item && item.length > 2 && !/^\d+$/.test(item));
  }

  function titleCaseWords(words) {
    return words
      .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
      .join(' ');
  }

  function pluralizeCategoryWord(word) {
    if (!word) return word;
    if (/s$/i.test(word)) return word;
    if (/y$/i.test(word)) return `${word.slice(0, -1)}ies`;
    return `${word}s`;
  }

  const CATEGORY_HEAD_NOUNS = new Set([
    'fan', 'fans', 'bumper', 'bumpers', 'stopper', 'stoppers', 'pad', 'pads', 'protector', 'protectors',
    'cover', 'covers', 'case', 'cases', 'holder', 'holders', 'rack', 'racks', 'bag', 'bags', 'box', 'boxes',
    'organizer', 'organizers', 'light', 'lights', 'lamp', 'lamps', 'brush', 'brushes', 'tool', 'tools',
    'strainer', 'strainers', 'drain', 'drains', 'sink', 'sinks', 'basket', 'baskets', 'filter', 'filters',
    'catcher', 'catchers', 'plug', 'plugs', 'mat', 'mats', 'tray', 'trays', 'container', 'containers',
  ]);

  const CATEGORY_MODIFIER_PRIORITY = [
    'handheld', 'portable', 'personal', 'cooling', 'cool', 'desk', 'table', 'floor', 'wall', 'ceiling',
    'cabinet', 'door', 'rubber', 'silicone', 'adhesive', 'furniture', 'corner', 'baby', 'safety',
    'kitchen', 'bathroom', 'shower', 'sink', 'drain', 'mesh', 'stainless', 'steel', 'anti', 'clog',
  ];

  const CATEGORY_MAPPING_RULES = [
    {
      id: 'desk-stationery-pen-holders',
      dxmCategoryPath: 'Office & School Supplies > Desk Accessories & Organizer > Pen Holders',
      searchTerms: ['Pen Holders', '\u7b14\u7b52', 'Pencil Holders', 'Pencil Cup', 'Desk Pen Holder'],
      positivePatterns: [
        /\b(?:pen|pencil)\s+(?:holder|holders|cup|cups)\b/i,
        /\bdesk\s+(?:pen|pencil)\s+(?:holder|holders|organizer|organizers)\b/i,
        /\brotating\s+(?:pen|pencil)\s+organizer\b/i,
        /\brotating\s+organizer\b.*\b(?:pencil|pencils|pen|pens|office supplies|school supplies)\b/i,
        /\b(?:pencil|pencils|pen|pens|scissors|office supplies|school supplies)\b.*\brotating\s+organizer\b/i,
        /\b(?:desktop|desk)\s+stationery\s+(?:storage|organizer)\b/i,
        /\b(?:stationery|office supplies|school supplies)\s+(?:holder|organizer|storage)\b/i,
        /\u684c\u9762\u6587\u5177\u6536\u7eb3|\u7b14\u7b52/i,
      ],
      negativePatterns: [
        /\bcable\b/i,
        /\bmakeup\b/i,
        /\bbathroom\b/i,
        /\bkitchen\b/i,
        /\bclothing\b/i,
        /\bwardrobe\b/i,
        /\bdrawer\b/i,
        /\bfile\b/i,
        /\bletter\b/i,
        /\bshoe\b/i,
        /\btoy\b/i,
      ],
    },
    {
      id: 'broad-drawer-organizer-trays',
      dxmCategoryPath: 'Home & Garden > Home Storage & Organization > Storage Boxes & Bins',
      searchTerms: ['Storage Boxes', 'Storage Bins', 'Storage Trays', 'Drawer Organizers', 'Desk Organizers', 'Makeup Organizer', 'Bathroom Storage', 'Kitchen Drawer Organizers'],
      positivePatterns: [
        /\bdrawer\s+(?:organizer|organizers|tray|trays|storage)\b/i,
        /\b(?:clear|plastic|acrylic)\s+(?:organizer|organizers|tray|trays|storage|bins?)\b/i,
        /\b(?:makeup|cosmetic|office supplies|desk|bathroom|kitchen)\b.*\b(?:organizer|organizers|tray|trays|storage|bins?)\b/i,
        /\b(?:organizer|organizers|tray|trays|storage|bins?)\b.*\b(?:makeup|cosmetic|office supplies|desk|bathroom|kitchen)\b/i,
      ],
      negativePatterns: [
        /\b(?:bra|bras|panty|panties|underwear|lingerie|sock|socks|clothing|wardrobe)\b/i,
      ],
    },
    {
      id: 'adhesive-cable-clips',
      dxmCategoryPath: 'Home Improvement > Electrical Equipment & Supplies > Cable Clips',
      searchTerms: ['Cable Clips', 'Cable Holders', 'Cable Management', 'Wire Clips', 'Cord Holder'],
      positivePatterns: [
        /\b(?:cable|wire|cord)\s+(?:clip|clips|holder|holders|organizer|organizers)\b/i,
        /\b(?:adhesive|self adhesive)\s+(?:cable|wire|cord)\b/i,
        /\b(?:charger|cord)\s+(?:holder|keeper|management)\b/i,
      ],
      negativePatterns: [
        /\b(?:electronic|charger\s+block|usb|battery|power\s+bank)\b/i,
      ],
    },
    {
      id: 'adhesive-wall-hooks',
      dxmCategoryPath: 'Home & Garden > Home Storage & Organization > Hooks & Rails',
      searchTerms: ['Adhesive Hooks', 'Wall Hooks', 'Utility Hooks', 'Hooks & Rails', 'Storage Hooks'],
      positivePatterns: [
        /\b(?:adhesive|self adhesive|wall|utility)\s+(?:hook|hooks)\b/i,
        /\b(?:hook|hooks)\b.*\b(?:wall|towel|coat|hanger|adhesive|kitchen|bathroom)\b/i,
      ],
      negativePatterns: [
        /\b(?:fishing|carabiner|baby|toy)\b/i,
      ],
    },
    {
      id: 'kitchen-sink-strainers',
      dxmCategoryPath: 'Home Improvement > Kitchen Fixture > Kitchen Sink Accessories > Kitchen Drains & Strainers',
      searchTerms: ['Kitchen Drains & Strainers', '\u53a8\u623f\u6c34\u69fd\u6c34\u6f0f\u3001\u8fc7\u6ee4\u7f51', 'Sink Strainer', 'Kitchen Sink Strainer', 'Drain Strainer', 'Sink Drain Strainer', 'Sink Filter', '\u6c34\u69fd', '\u6ee4\u7f51'],
      positivePatterns: [
        /\b(?:sink|drain)\s+(?:strainer|strainers|filter|filters|catcher|catchers|stopper|stoppers)\b/i,
        /\bkitchen\s+sink\b.*\b(?:strainer|filter|drain)\b/i,
      ],
      negativePatterns: [
        /\b(?:faucet|sprayer|pump)\b/i,
      ],
    },
    {
      id: 'bathroom-soap-dishes',
      dxmCategoryPath: 'Home & Garden > Bathroom Products > Soap Dishes',
      searchTerms: ['Soap Dishes', 'Soap Dish', 'Soap Holder', 'Bathroom Soap Holder', 'Soap Tray'],
      positivePatterns: [
        /\b(?:soap)\s+(?:dish|dishes|holder|holders|tray|trays|saver|savers)\b/i,
        /\b(?:bathroom|shower)\b.*\bsoap\b/i,
      ],
      negativePatterns: [
        /\b(?:dispenser|pump|liquid)\b/i,
      ],
    },
  ];

  function getMatchedCategoryMappingRules(contextText) {
    const source = String(contextText || '');
    return CATEGORY_MAPPING_RULES.filter((rule) => {
      const hasPositiveSignal = rule.positivePatterns.some((pattern) => pattern.test(source));
      if (!hasPositiveSignal) return false;
      return !rule.negativePatterns.some((pattern) => pattern.test(source));
    });
  }

  function pushCategoryMappingTerms(contextText, push) {
    for (const rule of getMatchedCategoryMappingRules(contextText)) {
      for (const term of rule.searchTerms) push(term);
    }
  }

  function isUsefulCategoryModifier(token) {
    return token && token.length > 2 && !CATEGORY_SEARCH_STOP_WORDS.has(token) && !/^\d+$/.test(token);
  }

  function buildCoreNounCategoryTerms(rawTitle) {
    const rawTokens = rawCategoryTitleTokens(rawTitle);
    const terms = [];
    const push = (words) => {
      const clean = words.filter(isUsefulCategoryModifier);
      if (clean.length) terms.push(titleCaseWords(clean));
    };

    for (let index = 0; index < rawTokens.length; index += 1) {
      const token = rawTokens[index];
      if (!CATEGORY_HEAD_NOUNS.has(token)) continue;
      const singular = token.replace(/s$/i, '');
      const plural = pluralizeCategoryWord(singular);
      const prev1 = rawTokens[index - 1];
      const prev2 = rawTokens[index - 2];

      push([singular]);
      if (plural !== singular) push([plural]);
      if (isUsefulCategoryModifier(prev1)) {
        push([prev1, singular]);
        push([prev1, plural]);
      }
      if (isUsefulCategoryModifier(prev2) && isUsefulCategoryModifier(prev1)) {
        push([prev2, prev1, singular]);
        push([prev2, prev1, plural]);
      }
    }

    return terms;
  }

  function buildHeadNounCategoryTerms(rawTitle) {
    const rawTokens = rawCategoryTitleTokens(rawTitle);
    const terms = [];
    const push = (words) => {
      const clean = words.filter(Boolean);
      if (clean.length >= 2) terms.push(titleCaseWords(clean));
    };
    for (let index = 0; index < rawTokens.length; index += 1) {
      const noun = rawTokens[index];
      if (!CATEGORY_HEAD_NOUNS.has(noun)) continue;
      const pluralNoun = pluralizeCategoryWord(noun.replace(/s$/i, ''));
      const windowStart = Math.max(0, index - 4);
      const previous = rawTokens.slice(windowStart, index);
      const prioritized = CATEGORY_MODIFIER_PRIORITY.filter((modifier) => previous.includes(modifier));
      for (const modifier of prioritized) push([modifier, pluralNoun]);
      if (previous.length) push([previous[previous.length - 1], pluralNoun]);
      if (previous.length >= 2) push([previous[previous.length - 2], previous[previous.length - 1], pluralNoun]);
    }
    return terms;
  }

  function buildCategorySearchTerms(payload, product, amazonItem = null) {
    const rawTitle = firstNonEmpty(payload.subject, product.subject, product.title, product.productTitle, '');
    const tokens = tokenizeCategoryTitle(rawTitle);
    const terms = [];
    const push = (value) => {
      const text = String(value || '').replace(/\s+/g, ' ').trim();
      if (text && !terms.some((item) => item.toLowerCase() === text.toLowerCase())) terms.push(text);
    };

    pushCategoryMappingTerms(
      [
        rawTitle,
        amazonItem && amazonItem.title,
        amazonItem && amazonItem.categoryTerm,
        amazonItem && amazonItem.detailTextSample,
        product.categoryName,
        product.categoryNameZh,
        product.sourceCategoryName,
      ].join(' '),
      push
    );

    if (amazonItem && amazonItem.categoryTerm) push(amazonItem.categoryTerm);
    for (const term of buildCoreNounCategoryTerms(rawTitle)) push(term);
    for (const term of buildHeadNounCategoryTerms(rawTitle)) push(term);
    const importantTokens = tokens.filter((token) => token.length >= 4);
    for (let size = Math.min(3, importantTokens.length); size >= 2; size -= 1) {
      for (let index = 0; index <= importantTokens.length - size; index += 1) {
        const slice = importantTokens.slice(index, index + size);
        push(titleCaseWords(slice));
        push(titleCaseWords([...slice.slice(0, -1), pluralizeCategoryWord(slice[slice.length - 1])]));
      }
    }
    for (const token of importantTokens.slice(0, 8)) {
      push(titleCaseWords([token]));
      push(titleCaseWords([pluralizeCategoryWord(token)]));
    }
    return terms.slice(0, 18);
  }

  function buildCategorySemanticContext(payload, product, amazonItem) {
    return normalizeCategoryText([
      payload && payload.subject,
      product && (product.subject || product.title || product.productTitle),
      product && (product.categoryName || product.categoryNameZh || product.sourceCategoryName),
      amazonItem && (amazonItem.title || amazonItem.categoryTerm || amazonItem.detailTextSample || amazonItem.rawText),
    ].filter(Boolean).join(' '));
  }

  const CATEGORY_FAMILY_SCORING_RULES = [
    {
      id: 'desk-pen-holder',
      evidence: /\b(?:rotating\s+)?(?:pen|pencil)\s+(?:holder|organizer|cup)|\bdesk\s+(?:pen|pencil)|\bart\s+supply\s+pencil|\u7b14\u7b52/i,
      allow: /\bpen\s+holders?\b|\bpencil\s+holders?\b|\bdesk\s+(?:accessories|organizer)|\boffice\s+supplies\b|\u7b14\u7b52|\u684c\u4e0a\u6536\u7eb3|\u529e\u516c/i,
      reject: /\bcable|wire|cord|hook|kitchen|bathroom|sink|soap|faucet\b|\u7ebf\u7f06|\u7535\u7ebf|\u6302\u94a9|\u53a8\u623f|\u6d74\u5ba4|\u6c34\u69fd|\u80a5\u7682/i,
    },
    {
      id: 'adhesive-cable-clips',
      evidence: /\b(?:cable|cord|wire)\s+(?:clip|clips|holder|holders|organizer|organizers)|\badhesive\s+(?:cable|cord|wire)|\u7ebf\u5939|\u7406\u7ebf/i,
      allow: /\bcable\s+(?:clip|clips|holder|holders|management)|\bwire\s+(?:clip|clips)|\bcord\s+(?:holder|clips)|\u7ebf\u5939|\u7406\u7ebf|\u7ebf\u7f06/i,
      reject: /\bconductive\b|\bglue\b|\bpaste\b|\bcream\b|\bpen\b|\bhook\b|\bfaucet\b|\bsoap\b|\u5bfc\u7535|\u80f6\u818f|\u80f6\u7c98|\u7b14\u7b52|\u6302\u94a9|\u6c34\u9f99\u5934|\u80a5\u7682/i,
    },
    {
      id: 'kitchen-sink-strainer',
      evidence: /\b(?:sink|drain)\s+(?:strainer|filter|catcher|stopper)|\bkitchen\s+sink|\u6c34\u69fd|\u6ee4\u7f51/i,
      allow: /\bsink\s+(?:strainer|filter|drain)|\bdrain\s+(?:strainer|filter|catcher|stopper)|\bkitchen\s+sink|\u6c34\u69fd|\u6ee4\u7f51|\u8fc7\u6ee4/i,
      reject: /\bfaucet\b|\bsprayer\b|\bpump\b|\bappliance\b|\belectric\b|\bcommercial\s+kitchen\b|\bsoap\b|\u6c34\u9f99\u5934|\u55b7\u5934|\u6cf5|\u7535\u5668|\u5546\u7528\u9910\u53a8|\u80a5\u7682/i,
    },
    {
      id: 'faucet-mat-splash-guard',
      evidence: /\bfaucet\s+mat\b|\bsink\s+splash\s+guard\b|\bfaucet\s+splash\b|\bfaucet\s+accessories\b|\bkitchen\s+sink\s+accessories\b|\u6c34\u9f99\u5934.{0,12}\u9632\u6e85|\u6c34\u69fd.{0,12}(\u9632\u6e85|\u63a5\u6c34)|\u6c34\u69fd\u914d\u4ef6|\u6c34\u9f99\u5934\u914d\u4ef6/i,
      allow: /\bfaucet\s+accessories\b|\bkitchen\s+sink\s+accessories\b|\bsink\s+accessories\b|\bfaucet\s+mat\b|\bsink\s+splash\s+guard\b|\bfaucet\s+splash\b|\u6c34\u9f99\u5934\u914d\u4ef6|\u6c34\u69fd\u914d\u4ef6|\u6c34\u9f99\u5934.{0,12}\u9632\u6e85|\u6c34\u69fd.{0,12}(\u9632\u6e85|\u63a5\u6c34)/i,
      reject: /\boil\s*(?:absorbing|proof)?\s*paper\b|\bgrease\s*paper\b|\bmosquito\b|\bincense\b|\bbattery\b|\bdrains?\s*&\s*strainers?\b|\bdrain\s+(?:augers?|cleaner|cleaning|snake|snakes?|tools?)\b|\bsink\s+(?:strainer|drain|stopper|plug|fixture)\b|\bfilter\b|\bglass\s+rinser\b|\bcup\s+(?:rinser|washer)\b|\bbottle\s+washer\b|\bkitchen\s+fixture\b|\u5438\u6cb9\u7eb8|\u9632\u6cb9\u7eb8|\u868a\u9999|\u7535\u6c60|\u8fc7\u6ee4\u7f51|\u6ee4\u7f51|\u6c34\u6f0f|\u6392\u6c34\u87ba\u65cb|\u7ba1\u9053\u758f\u901a|\u4e0b\u6c34\u9053|\u676f\u6d17\u5668|\u6d17\u676f\u5668|\u6d17\u74f6\u5668|\u53a8\u623f\u8bbe\u65bd/i,
    },
    {
      id: 'storage-boxes-bins',
      evidence: /\bstorage\s+(?:boxes?|bins?|cubes?)\b|\bstorage\s+boxes?\s*&\s*bins?\b|\bhome\s+storage\b|\u6536\u7eb3\u76d2|\u6536\u7eb3\u7bb1|\u6536\u7eb3\u76d2\u548c\u6536\u7eb3\u7bb1/i,
      allow: /\bstorage\s+boxes?\s*&\s*bins?\b|\bstorage\s+(?:boxes?|bins?)\b|\bhome\s+storage\s*&?\s*organization\b|\u6536\u7eb3\u76d2\u548c\u6536\u7eb3\u7bb1|\u6536\u7eb3\u76d2|\u6536\u7eb3\u7bb1|\u5bb6\u7528\u50a8\u5b58/i,
      reject: /\bbattery\b|\bmosquito\b|\bincense\b|\bcable\b|\bwire\b|\bfaucet\b|\bsink\b|\bsoap\b|\bhook\b|\u7535\u6c60|\u868a\u9999|\u7ebf\u7f06|\u7535\u7ebf|\u6c34\u9f99\u5934|\u6c34\u69fd|\u80a5\u7682|\u6302\u94a9/i,
    },
    {
      id: 'silicone-trivet-placemat-adjacent',
      evidence: /\b(?:silicone\s+)?(?:pot\s+holders?|hot\s+pads?|trivets?|heat\s+resistant\s+(?:mat|pad|pads))\b|\bjar\s+opener\b|\bspoon\s+rest\b|\u9694\u70ed\u57ab|\u9505\u57ab|\u9632\u70eb\u57ab/i,
      allow: /\bplacemats?\b|\btable\s+linen\b|\bhome\s+textile\b|\u9910\u57ab|\u9910\u684c\u5e03\u827a|\u5bb6\u7eba/i,
      reject: /\bcoasters?\b|\bteapot\b|\btea\s+pot\b|\btablecloth\b|\boven\s+mitts?\b|\bgloves?\b|\u676f\u57ab|\u8336\u58f6|\u684c\u5e03|\u624b\u5957/i,
    },
    {
      id: 'adhesive-wall-hooks',
      evidence: /\b(?:adhesive|wall|utility|coat|towel)\s+hooks?|\bhooks?\b.*\b(?:wall|adhesive|towel|coat)|\u6302\u94a9/i,
      allow: /\bwall\s+hooks?|\badhesive\s+hooks?|\bcoat\s+hooks?|\btowel\s+hooks?|\bhooks?\s*&\s*rails|\u6302\u94a9|\u8863\u5e3d\u6302\u94a9|\u5899\u6302/i,
      reject: /\bcable|wire|cord|fishing|carabiner|pen|sink|faucet\b|\u7ebf\u7f06|\u7535\u7ebf|\u7b14\u7b52|\u6c34\u69fd|\u6c34\u9f99\u5934/i,
    },
  ];

  function getCategoryFamilyScoringRule(contextText) {
    const context = String(contextText || '');
    return CATEGORY_FAMILY_SCORING_RULES.find((rule) => rule.evidence.test(context)) || null;
  }

  function scoreCategoryFamilyCandidateText(candidateText, contextText) {
    const rule = getCategoryFamilyScoringRule(contextText);
    if (!rule) return { familyId: '', blocked: false, bonus: 0, penalty: 0, reason: '' };
    const text = String(candidateText || '');
    if (rule.reject.test(text)) {
      return { familyId: rule.id, blocked: true, bonus: 0, penalty: 0.8, reason: `family_reject:${rule.id}` };
    }
    if (rule.allow.test(text)) {
      return { familyId: rule.id, blocked: false, bonus: 0.45, penalty: 0, reason: `family_allow:${rule.id}` };
    }
    return { familyId: rule.id, blocked: false, bonus: 0, penalty: 0.18, reason: `family_unconfirmed:${rule.id}` };
  }

  function getCategoryPathSemanticPenalty(candidate, payload, product, searchTerm) {
    const amazonItem = getAmazonBatchItem(product || {});
    const context = buildCategorySemanticContext(payload, product, amazonItem);
    const pathText = normalizeCategoryText(`${candidate.categoryName || ''} ${candidate.categoryPath || ''}`);
    const familyScore = scoreCategoryFamilyCandidateText(pathText, context);
    if (familyScore.blocked) {
      return {
        penalty: familyScore.penalty,
        reason: familyScore.reason,
        searchTerm,
        familyId: familyScore.familyId,
      };
    }
    const isClothingStoragePath = /衣物|内衣|clothing|wardrobe|underwear|lingerie/.test(pathText);
    const hasClothingSignal = /\b(?:bra|bras|panty|panties|underwear|lingerie|sock|socks|clothing|wardrobe|closet|drawer\s+divider\s+for\s+clothes)\b|衣物|内衣|袜|衣柜/.test(context);
    const hasBroadOrganizerSignal = /\b(?:drawer\s+organizer|organizer\s+tray|storage\s+tray|storage\s+bin|makeup|cosmetic|office supplies|desk|bathroom|kitchen|pantry|plastic|acrylic)\b/.test(context);
    if (isClothingStoragePath && !hasClothingSignal && hasBroadOrganizerSignal) {
      return {
        penalty: 0.55,
        reason: 'category_path_too_narrow_clothing_or_underwear_without_product_evidence',
        searchTerm,
      };
    }
    return { penalty: 0, reason: '' };
  }

  function scoreDxmCategoryCandidate(candidate, payload, product, searchTerm) {
    const title = normalizeCategoryText(firstNonEmpty(payload.subject, product.subject, product.title, product.productTitle, ''));
    const categoryText = normalizeCategoryText(`${candidate.categoryName || ''} ${candidate.categoryPath || ''}`);
    const amazonItem = getAmazonBatchItem(product || {});
    const familyScore = scoreCategoryFamilyCandidateText(categoryText, buildCategorySemanticContext(payload, product, amazonItem));
    const tokens = tokenizeCategoryTitle(title);
    const uniqueTokens = [...new Set(tokens)];
    const matchedCount = uniqueTokens.filter((token) => categoryText.includes(token)).length;
    const denominator = Math.max(1, Math.min(6, uniqueTokens.length));
    let score = matchedCount / denominator;
    const normalizedTerm = normalizeCategoryText(searchTerm);
    if (normalizedTerm && categoryText.includes(normalizedTerm)) score += 0.35;
    if (candidate.isLeaf) score += 0.12;
    if (normalizeCategoryText(candidate.categoryName) === normalizedTerm) score += 0.18;
    if (familyScore.bonus) {
      candidate.familyScore = familyScore;
      score += familyScore.bonus;
    } else if (familyScore.penalty && !familyScore.blocked) {
      candidate.familyScore = familyScore;
      score -= familyScore.penalty;
    }
    const semantic = getCategoryPathSemanticPenalty(candidate, payload, product, searchTerm);
    if (semantic.penalty) {
      candidate.semanticPenalty = semantic;
      score -= semantic.penalty;
    }
    return Math.max(0, Math.min(1, Math.round(score * 100) / 100));
  }

  async function fetchDxmCategoryAttributes(categoryId, shopId) {
    const calls = [];
    const attributeBodies = [
      {
        url: '/api/smtlocalCategory/attributeList.json',
        options: {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: new URLSearchParams({ categoryId: String(categoryId) }),
        },
      },
      {
        url: '/api/categoryAttrMatch/getCategoryAttr10464dd7.json',
        options: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=UTF-8' },
          body: JSON.stringify({ platform: 'smtlocal', categoryId: String(categoryId), shopId: String(shopId || '') }),
        },
      },
    ];

    for (const item of attributeBodies) {
      try {
        const response = await apiFetchJson(item.url, item.options);
        calls.push({ url: item.url, ok: true });
        if (response) return { response, calls };
      } catch (error) {
        calls.push({ url: item.url, ok: false, error: String(error && error.message ? error.message : error) });
      }
    }
    return { response: null, calls };
  }

  function parseDxmNames(value) {
    const parsed = parseMaybeJson(value, null);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return {
        en: String(firstNonEmpty(parsed.en, parsed.EN, parsed.name, parsed.value, '')).trim(),
        zh: String(firstNonEmpty(parsed.zh, parsed.ZH, '')).trim(),
      };
    }
    return { en: String(value || '').trim(), zh: '' };
  }

  function getDxmAttributeValues(attribute) {
    const rawValues = parseMaybeJson(attribute && attribute.values, []);
    if (!Array.isArray(rawValues)) return [];
    return rawValues
      .map((item) => {
        const names = parseDxmNames(item && item.names);
        const name = firstNonEmpty(names.en, names.zh, item && item.name, item && item.value, item && item.id);
        return {
          id: item && item.id == null ? '' : String(item.id),
          name: String(name || '').trim(),
          raw: item,
        };
      })
      .filter((item) => item.id || item.name);
  }

  function findDxmValue(values, patterns) {
    for (const pattern of patterns) {
      const matcher = pattern instanceof RegExp ? pattern : new RegExp(`^${String(pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      const found = values.find((item) => matcher.test(String(item.name || '').trim()));
      if (found) return found;
    }
    return null;
  }

  function inferMaterialCandidates(payload, product) {
    const amazonItem = getAmazonBatchItem(product || {});
    const source = normalizeCategoryText([
      payload && payload.subject,
      product && (product.subject || product.title || product.productTitle || product.detailText || product.detailWeb),
      amazonItem && (amazonItem.title || amazonItem.detailTextSample || amazonItem.rawText),
    ].filter(Boolean).join(' '));
    const candidates = [];
    const push = (value, patterns) => {
      if (patterns.some((pattern) => pattern.test(source)) && !candidates.includes(value)) candidates.push(value);
    };
    push('acrylic', [/\bacrylic\b/, /\bplexiglass\b/, /\bpmma\b/]);
    push('plastic', [/\bplastic\b/, /\bpp\b/, /\bpet\b/, /\babs\b/, /\bpolypropylene\b/, /\bpolyethylene\b/]);
    push('silicone', [/\bsilicone\b/]);
    push('rubber', [/\brubber\b/]);
    push('metal', [/\bmetal\b/, /\bstainless steel\b/, /\baluminum\b/, /\baluminium\b/, /\bcopper\b/]);
    push('wood', [/\bwood\b/, /\bbamboo\b/]);
    push('fiberglass', [/\bfiberglass\b/, /\bglass fiber\b/]);
    return candidates.length ? candidates : ['plastic'];
  }

  function chooseDxmAttributeValue(attribute, payload, product) {
    const values = getDxmAttributeValues(attribute);
    if (!values.length) return null;
    const attrName = normalizeCategoryText(firstNonEmpty(attribute.attrName, attribute.attrNameZh, attribute.attrNameId));
    const title = normalizeCategoryText(firstNonEmpty(payload.subject, product.subject, product.title, product.productTitle, ''));

    if (attrName.includes('brand')) return findDxmValue(values, [/^none$/i, /^no brand$/i]) || values[0];
    if (attrName.includes('high-concerned chemical')) return findDxmValue(values, [/\u5929\u7136\u672a\u5904\u7406/i, /^none$/i, /^no$/i]) || values[0];
    if (attrName.includes('origin')) {
      return findDxmValue(values, [/us\(origin\)/i, /united states/i, /\busa\b/i, /\bus\b/i, /\u7f8e\u56fd/i]) || values[0];
    }
    if (attrName.includes('function')) {
      return findDxmValue(values, [/^other$/i, /\u5176\u4ed6/i, /reusable/i, /\u53ef\u91cd\u590d\u4f7f\u7528/i]) || values[0];
    }
    if (attrName === 'use' || attrName.includes(' use') || attrName.includes('\u7528\u9014')) {
      return findDxmValue(values, [/^other$/i, /\u5176\u4ed6/i, /home/i, /household/i, /office/i, /storage/i]) || values[0];
    }
    if (attrName.includes('electric')) {
      if (/rechargeable|battery|usb|electric|power/i.test(title)) return findDxmValue(values, [/^yes$/i]) || values[0];
      return findDxmValue(values, [/^no$/i]) || values[0];
    }
    if (attrName.includes('foldable')) {
      return findDxmValue(values, title.includes('fold') ? [/^yes$/i] : [/^no$/i]) || values[0];
    }
    if (attrName.includes('remote control')) {
      return findDxmValue(values, title.includes('remote') ? [/^yes$/i] : [/^no$/i]) || values[0];
    }
    if (attrName.includes('number') && (attrName.includes('rib') || attrName.includes('blade'))) {
      const numberMatch = title.match(/\b(\d{1,2})\s*(?:blade|blades|rib|ribs)\b/);
      if (numberMatch) {
        const exact = findDxmValue(values, [new RegExp(`^${numberMatch[1]}$`, 'i')]);
        if (exact) return exact;
      }
      return findDxmValue(values, [/^none$/i, /^1$/i]) || values[0];
    }
    if (attrName.includes('material')) {
      const materialTerms = inferMaterialCandidates(payload, product);
      for (const term of materialTerms) {
        const matched = findDxmValue(values, [new RegExp(term, 'i')]);
        if (matched) return matched;
      }
      return findDxmValue(values, [/^plastic$/i, /^abs$/i, /acrylic/i, /silicone/i, /rubber/i, /^metal$/i]) || values[0];
    }
    return findDxmValue(values, [/^none$/i, /^no$/i, /^other$/i]) || values[0];
  }

  function buildDxmRequiredProperties(attributeResponse, payload, product) {
    const attributes = attributeResponse && Array.isArray(attributeResponse.data) ? attributeResponse.data : [];
    return attributes
      .filter((attribute) => Number(attribute && attribute.isRequired) === 1 && Number(attribute && attribute.isSku) !== 1)
      .map((attribute) => {
        const selected = chooseDxmAttributeValue(attribute, payload, product);
        if (!selected) return null;
        return {
          attr_name_id: String(attribute.attrNameId),
          attr_name: String(firstNonEmpty(attribute.attrName, attribute.attrNameZh, attribute.attrNameId)),
          attr_value_id: selected.id,
          attr_value: selected.name,
          attr_value_unit: null,
          attr_value_start: null,
          attr_value_end: null,
        };
      })
      .filter(Boolean);
  }

  const SKU_VALUE_SYNONYMS = {
    color: {
      apricot: [/^creamy white$/i, /^khaki$/i, /^light yellow$/i, /^orange$/i],
      beige: [/^khaki$/i, /^creamy white$/i, /^light yellow$/i],
      cream: [/^creamy white$/i, /^white$/i],
      creamy: [/^creamy white$/i, /^white$/i],
      ivory: [/^creamy white$/i, /^white$/i],
      grey: [/^grey$/i, /^light grey$/i, /^dark gray$/i],
      gray: [/^grey$/i, /^light grey$/i, /^dark gray$/i],
      black: [/^black$/i],
      white: [/^white$/i, /^pure white$/i],
      blue: [/^blue$/i, /blue/i],
      green: [/^green$/i, /green/i],
      red: [/^red$/i],
      yellow: [/^yellow$/i, /^light yellow$/i],
      orange: [/^orange$/i],
      brown: [/^brown$/i],
      silver: [/^silver$/i],
      gold: [/^gold$/i],
      purple: [/violet/i],
      violet: [/violet/i],
      navy: [/^navy$/i, /blue/i],
      khaki: [/^khaki$/i, /^dark khaki$/i],
    },
  };

  function chooseSkuAttributeValue(attribute, rawValue) {
    const values = getDxmAttributeValues(attribute);
    if (!values.length) return null;
    const normalizedRaw = normalizeCategoryText(rawValue);
    if (!normalizedRaw) return null;
    const exact = values.find((item) => normalizeCategoryText(item.name) === normalizedRaw);
    if (exact) return exact;

    const attrName = normalizeCategoryText(firstNonEmpty(attribute.attrName, attribute.attrNameZh, attribute.attrNameId));
    const synonymGroup = SKU_VALUE_SYNONYMS[attrName];
    if (synonymGroup) {
      for (const [sourceTerm, patterns] of Object.entries(synonymGroup)) {
        if (!normalizedRaw.includes(sourceTerm)) continue;
        const found = findDxmValue(values, patterns);
        if (found) return found;
      }
    }
    return null;
  }

  function applyDxmSkuAttributeIds(payload, attributeResponse) {
    const attributes = attributeResponse && Array.isArray(attributeResponse.data) ? attributeResponse.data : [];
    const skuAttributes = attributes.filter((attribute) => Number(attribute && attribute.isSku) === 1);
    if (!skuAttributes.length) return { changed: false, rowsChanged: 0 };
    const variations = parseMaybeJson(payload.variationListStr, []);
    if (!Array.isArray(variations) || !variations.length) return { changed: false, rowsChanged: 0 };
    let rowsChanged = 0;

    for (const sku of variations) {
      const skuProperties = parseMaybeJson(sku.skuPropertyListJson, []);
      if (!Array.isArray(skuProperties) || !skuProperties.length) continue;
      let rowChanged = false;
      for (const property of skuProperties) {
        const propertyName = normalizeCategoryText(firstNonEmpty(property.sku_property_name, property.propertyName, ''));
        const attribute = skuAttributes.find((item) => normalizeCategoryText(item.attrName) === propertyName);
        if (!attribute) continue;
        if (String(property.sku_property_id || '') !== String(attribute.attrNameId)) {
          property.sku_property_id = String(attribute.attrNameId);
          rowChanged = true;
        }
        if (!property.property_value_id) {
          const currentValue = normalizeCategoryText(firstNonEmpty(property.sku_property_value, property.property_value_definition_name, ''));
          const selected = chooseSkuAttributeValue(attribute, currentValue);
          if (selected && selected.id) {
            property.property_value_id = selected.id;
            if (normalizeCategoryText(selected.name) !== currentValue) {
              property.property_value_definition_name = firstNonEmpty(property.property_value_definition_name, property.sku_property_value);
              property.sku_property_value = selected.name;
            }
            rowChanged = true;
          }
        }
      }
      if (rowChanged) {
        sku.skuPropertyListJson = JSON.stringify(skuProperties);
        rowsChanged += 1;
      }
    }
    if (rowsChanged) payload.variationListStr = JSON.stringify(variations);
    return { changed: rowsChanged > 0, rowsChanged };
  }

  async function resolveCategoryWithDxmApi(payload, editData) {
    const product = getProductFromEdit(editData) || {};
    const diagnostics = payload.__diagnostics && payload.__diagnostics.derived ? payload.__diagnostics.derived : null;
    const currentResolver = diagnostics ? diagnostics.categoryResolver : null;
    if (currentResolver && currentResolver.status === 'resolved' && isNumericPublishCategoryId(payload.categoryId)) {
      return currentResolver;
    }

    const shopId = String(firstNonEmpty(payload.shopId, product.shopId, product.shop_id, ''));
    if (!shopId) return currentResolver;
    const amazonItem = getAmazonBatchItem(product);
    const terms = buildCategorySearchTerms(payload, product, amazonItem);
    const attempts = [];
    let best = null;

    for (const term of terms) {
      try {
        const response = await apiFetchJson('/api/smtlocalCategory/listByCategoryName.json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: new URLSearchParams({ shopId, categoryName: term }),
        });
        const candidates = collectCategoryCandidates(response)
          .map((candidate) => ({
            ...candidate,
            confidence: scoreDxmCategoryCandidate(candidate, payload, product, term),
            searchTerm: term,
          }))
          .sort((a, b) => b.confidence - a.confidence);
        attempts.push({
          term,
          count: candidates.length,
          top: candidates.slice(0, 5).map((candidate) => ({
            categoryId: candidate.categoryId,
            categoryName: candidate.categoryName,
            categoryPath: candidate.categoryPath,
            confidence: candidate.confidence,
            familyScore: candidate.familyScore || null,
            semanticPenalty: candidate.semanticPenalty || null,
          })),
        });
        if (candidates[0] && (!best || candidates[0].confidence > best.confidence)) best = candidates[0];
        if (best && best.confidence >= 0.9) break;
      } catch (error) {
        attempts.push({ term, error: String(error && error.message ? error.message : error) });
      }
    }

    const resolved = best && best.confidence >= 0.72 && isNumericPublishCategoryId(best.categoryId);
    const resolver = resolved
      ? {
          status: 'resolved',
          source: 'dianxiaomi_category_search_api',
          publishCategoryId: String(best.categoryId),
          categoryPath: best.categoryPath || best.categoryName || '',
          properties: getCategoryPropertiesById(best.categoryId),
          confidence: best.confidence,
          ruleId: `dxm-category-search:${best.categoryId}`,
          matchedTerms: [best.searchTerm, best.categoryName].filter(Boolean),
          attempts,
          selected: {
            categoryId: best.categoryId,
            categoryName: best.categoryName,
            categoryPath: best.categoryPath,
            isLeaf: best.isLeaf,
            familyScore: best.familyScore || null,
            semanticPenalty: best.semanticPenalty || null,
          },
        }
      : {
          status: 'unresolved',
          source: 'dianxiaomi_category_search_api',
          publishCategoryId: '',
          categoryPath: '',
          properties: null,
          confidence: best ? best.confidence : 0,
          ruleId: best ? `dxm-category-search-candidate:${best.categoryId}` : '',
          matchedTerms: best ? [best.searchTerm, best.categoryName].filter(Boolean) : [],
          attempts,
          selected: best
            ? {
                categoryId: best.categoryId,
                categoryName: best.categoryName,
                categoryPath: best.categoryPath,
                isLeaf: best.isLeaf,
                familyScore: best.familyScore || null,
                semanticPenalty: best.semanticPenalty || null,
              }
            : null,
        };

    if (diagnostics) {
      diagnostics.categoryResolver = resolver;
      diagnostics.defaultRulesApplied = diagnostics.defaultRulesApplied || [];
    }

    if (resolved) {
      payload.categoryId = String(best.categoryId);
      if (diagnostics && diagnostics.defaultRulesApplied) {
        diagnostics.defaultRulesApplied.push(`categoryId resolved by Dianxiaomi category search API: ${best.categoryId} ${best.categoryName}`);
      }
      const attrResult = await fetchDxmCategoryAttributes(best.categoryId, shopId);
      resolver.attributeFetch = attrResult.calls;
      resolver.attributeResponseCaptured = Boolean(attrResult.response);
      if (attrResult.response) {
        const requiredProperties = buildDxmRequiredProperties(attrResult.response, payload, product);
        if (requiredProperties.length) {
          const beforeProperties = parseMaybeJson(payload.productPropertyListJson, []);
          payload.productPropertyListJson = JSON.stringify(mergeRequiredProperties(beforeProperties, requiredProperties));
          resolver.properties = requiredProperties;
          resolver.requiredPropertyCount = requiredProperties.length;
          if (diagnostics && diagnostics.defaultRulesApplied) {
            diagnostics.defaultRulesApplied.push(`dynamic category required properties applied: ${requiredProperties.map((item) => item.attr_name).join(', ')}`);
          }
        }
        const skuPatch = applyDxmSkuAttributeIds(payload, attrResult.response);
        resolver.skuAttributePatch = skuPatch;
        if (skuPatch.changed && diagnostics && diagnostics.defaultRulesApplied) {
          diagnostics.defaultRulesApplied.push(`dynamic SKU attribute ids applied on ${skuPatch.rowsChanged} rows`);
        }
      }
    } else if (diagnostics && diagnostics.defaultRulesApplied) {
      diagnostics.defaultRulesApplied.push('category search API did not find a high-confidence publish category; keep dry-run blocked');
    }

    return resolver;
  }

  const state = {
    productId: '',
    editData: null,
    inputEditData: null,
    afterOp1EditData: null,
    payload: null,
    zipBlob: null,
    report: null,
    savePayloadLearning: null,
    apiRecords: [],
    publishResult: null,
    submitting: false,
  };

  function $(selector) {
    return document.querySelector(selector);
  }

  function getPanelInputValue(field, fallback = '') {
    const input = $(`#${PANEL_ID} [data-field="${field}"]`);
    if (input && input.value != null && String(input.value).trim() !== '') {
      return String(input.value).trim();
    }
    return fallback;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function rememberApiRecord(record) {
    state.apiRecords.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: nowIso(),
      page: location.href,
      ...record,
    });
    state.apiRecords = state.apiRecords.slice(-200);
  }

  function installPublishNetworkObserver() {
    if (window.__dxmAutomationPublishObserverInstalled) return;
    window.__dxmAutomationPublishObserverInstalled = true;
    const shouldRecord = (url) => /smtlocalProduct|publish|online|offline|save\.json/i.test(String(url || ''));

    const originalFetch = window.fetch;
    if (typeof originalFetch === 'function') {
      window.fetch = async function dxmAutomationFetch(input, init) {
        const url = typeof input === 'string' ? input : input && input.url;
        const method = (init && init.method) || (input && input.method) || 'GET';
        const startedAt = performance.now();
        const response = await originalFetch.apply(this, arguments);
        if (shouldRecord(url)) {
          response.clone().text().then((text) => {
            rememberApiRecord({
              source: 'window.fetch',
              url: String(url || ''),
              method: String(method).toUpperCase(),
              status: response.status,
              ok: response.ok,
              durationMs: Math.round(performance.now() - startedAt),
              responseText: text.slice(0, 2000),
            });
          }).catch(() => {});
        }
        return response;
      };
    }

    const OriginalXHR = window.XMLHttpRequest;
    if (typeof OriginalXHR === 'function') {
      window.XMLHttpRequest = function DxmAutomationXMLHttpRequest() {
        const xhr = new OriginalXHR();
        let meta = { method: '', url: '' };
        const originalOpen = xhr.open;
        xhr.open = function open(method, url) {
          meta = { method: String(method || 'GET').toUpperCase(), url: String(url || '') };
          return originalOpen.apply(xhr, arguments);
        };
        xhr.addEventListener('loadend', () => {
          if (!shouldRecord(meta.url)) return;
          rememberApiRecord({
            source: 'XMLHttpRequest',
            url: meta.url,
            method: meta.method,
            status: xhr.status,
            ok: xhr.status >= 200 && xhr.status < 300,
            responseText: String(xhr.responseText || '').slice(0, 2000),
          });
        });
        return xhr;
      };
    }
  }

  function log(message, detail) {
    const box = $(`#${PANEL_ID} [data-field="log"]`);
    if (!box) return;
    const line = document.createElement('div');
    line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    box.prepend(line);
    if (detail !== undefined) console.info(`[${APP_NAME}] ${message}`, detail);
  }

  function setText(name, value) {
    const node = $(`#${PANEL_ID} [data-field="${name}"]`);
    if (node) node.textContent = value == null ? '' : String(value);
  }

  function updateUi() {
    setText('productId', state.productId || '\u672a\u8bfb\u53d6');
    setText('dryRun', state.report ? (state.report.pass ? '\u901a\u8fc7' : '\u672a\u901a\u8fc7') : '\u672a\u6267\u884c');
    setText('riskCount', state.report && Array.isArray(state.report.risks) ? state.report.risks.length : 0);
    setText('publishStatus', state.publishResult ? state.publishResult.status : '未执行');
    setText(
      'op1Persistence',
      state.report && state.report.persistenceCheck
        ? state.report.persistenceCheck.persisted
          ? '\u5df2\u843d\u5e93'
          : '\u672a\u901a\u8fc7'
        : '\u672a\u9a8c\u8bc1'
    );
    const submitButton = $(`#${PANEL_ID} [data-action="submit"]`);
    const saveCompletionButton = $(`#${PANEL_ID} [data-action="saveCompletion"]`);
    const downloadButton = $(`#${PANEL_ID} [data-action="downloadZip"]`);
    const reportButton = $(`#${PANEL_ID} [data-action="downloadReport"]`);
    const runBundleButton = $(`#${PANEL_ID} [data-action="downloadRunBundle"]`);
    const learnSavePayloadButton = $(`#${PANEL_ID} [data-action="learnSavePayload"]`);
    const publishCurrentButton = $(`#${PANEL_ID} [data-action="publishCurrentTest"]`);
    const allow = $(`#${PANEL_ID} [data-field="allowSubmit"]`);
    const code = $(`#${PANEL_ID} [data-field="submitCode"]`);
    const canSubmit = false;
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.title = '本阶段禁止 op=2；仅允许 save.json op=1 落库验证';
    }
    if (saveCompletionButton) saveCompletionButton.disabled = !state.report || !state.report.pass || state.submitting;
    if (downloadButton) downloadButton.disabled = !state.zipBlob;
    if (reportButton) reportButton.disabled = !state.report;
    if (runBundleButton) runBundleButton.disabled = !state.report;
    if (learnSavePayloadButton) learnSavePayloadButton.disabled = state.submitting;
    if (publishCurrentButton) publishCurrentButton.disabled = state.submitting || !/\/web\/smtlocalProduct\/offline/i.test(location.pathname);
    if (saveCompletionButton) {
      saveCompletionButton.title = '调用 save.json op=1，验证是否可替代 UI 保存并进入 DXM 产品库；不会调用 op=2 发布。';
    }
  }

  function extractProductIdFromCurrentPage() {
    const search = new URLSearchParams(location.search);
    const queryId = firstNonEmpty(search.get('id'), search.get('productId'), search.get('ids'));
    if (/^\d{10,}$/.test(String(queryId || ''))) return String(queryId);

    const inputs = Array.from(document.querySelectorAll('input[name="id"], input[name="productId"], input[data-field*="id" i]'));
    for (const input of inputs) {
      if (/^\d{10,}$/.test(String(input.value || ''))) return String(input.value);
    }

    const hrefMatch = location.href.match(/(?:id|productId)[=/](\d{10,})/i);
    if (hrefMatch) return hrefMatch[1];

    const text = document.body ? document.body.innerText : '';
    const idMatch = text.match(/\b(1\d{17})\b/);
    return idMatch ? idMatch[1] : '';
  }

  function extractProductIdFromText(text) {
    const source = String(text || '');
    const patterns = [
      /(?:id|productId|product_id|ids)[^\d]{0,12}(1\d{17})/i,
      /\b(1\d{17})\b/,
    ];
    for (const pattern of patterns) {
      const match = source.match(pattern);
      if (match) return match[1];
    }
    return '';
  }

  function extractProductIdFromNode(node) {
    if (!node) return '';
    const chunks = [];
    const push = (value) => {
      if (value !== undefined && value !== null) chunks.push(String(value));
    };

    if (node.matches && node.matches('input')) push(node.value);
    if (node.getAttribute) {
      for (const attr of ['href', 'onclick', 'data-id', 'data-product-id', 'data-productid', 'value']) {
        push(node.getAttribute(attr));
      }
    }
    for (const child of Array.from(node.querySelectorAll ? node.querySelectorAll('a,button,input,[onclick],[data-id],[data-product-id],[data-productid]') : [])) {
      push(child.value);
      for (const attr of ['href', 'onclick', 'data-id', 'data-product-id', 'data-productid', 'value']) {
        push(child.getAttribute && child.getAttribute(attr));
      }
    }
    return extractProductIdFromText(chunks.join(' '));
  }

  function getProductRowsFromCurrentList() {
    const rows = Array.from(document.querySelectorAll('tbody tr, table tr')).filter((row) => {
      const text = row.innerText || '';
      return row.querySelector('img') && (text.includes('\u7f16\u8f91') || text.includes('\u53d1\u5e03') || text.includes('\u66f4\u591a') || text.includes('\u4e9a\u9a6c\u900a'));
    });
    return rows.length ? rows : Array.from(document.querySelectorAll('tr')).filter((row) => row.querySelector('input[type="checkbox"]'));
  }

  function extractProductIdFromCurrentList() {
    const rows = getProductRowsFromCurrentList();
    const checkedRow = rows.find((row) => row.querySelector('input[type="checkbox"]:checked'));
    const candidates = checkedRow ? [checkedRow, ...rows.filter((row) => row !== checkedRow)] : rows;
    for (const row of candidates) {
      const id = extractProductIdFromNode(row);
      if (id) return id;
    }
    return '';
  }

  function visibleElement(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  }

  function getInputText(element) {
    if (!element) return '';
    if (element.isContentEditable) return String(element.textContent || '').trim();
    return String(element.value || element.getAttribute('value') || '').trim();
  }

  function getVisibleInputValues() {
    return Array.from(document.querySelectorAll('input,textarea,[contenteditable="true"]'))
      .filter(visibleElement)
      .map((node) => ({
        node,
        text: getInputText(node),
        placeholder: String(node.getAttribute('placeholder') || ''),
        name: String(node.getAttribute('name') || ''),
        title: String(node.getAttribute('title') || ''),
        type: String(node.getAttribute('type') || ''),
      }))
      .filter((item) => item.text);
  }

  function findVisibleInputValue(test) {
    const item = getVisibleInputValues().find(test);
    return item ? item.text : '';
  }

  function extractShopIdFromCurrentPage() {
    const html = document.documentElement ? document.documentElement.innerHTML : '';
    const patterns = [
      /["']shopId["']\s*[:=]\s*["']?(\d{5,})["']?/i,
      /shopId[^\d]{0,20}(\d{5,})/i,
      /shop_id[^\d]{0,20}(\d{5,})/i,
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1] !== '-1') return match[1];
    }
    return getDefaultShopId();
  }

  function extractSubjectFromCurrentEditPage() {
    const titleLike = findVisibleInputValue((item) => {
      const text = item.text;
      if (text.length < 20) return false;
      if (/^https?:\/\//i.test(text)) return false;
      if (/^\d+(\.\d+)?$/.test(text)) return false;
      return /[a-z]/i.test(text);
    });
    return titleLike;
  }

  function extractSourceUrlFromCurrentEditPage() {
    return findVisibleInputValue((item) => /amazon\.com|\/dp\/B0/i.test(item.text));
  }

  function extractMainImagesFromCurrentEditPage() {
    const urls = Array.from(document.querySelectorAll('img'))
      .map((img) => img.currentSrc || img.src || img.getAttribute('data-src') || '')
      .filter((url) => /^https?:\/\//i.test(url))
      .filter((url) => !/logo|avatar|icon|sprite|data:image/i.test(url))
      .filter((url) => /amazon|alicdn|cos|wxalbum|images/i.test(url));
    return Array.from(new Set(urls)).slice(0, 8);
  }

  function extractEditPageSkuSnapshot(sourceUrl, subject) {
    const asin = extractAsin(`${sourceUrl} ${subject}`);
    const values = getVisibleInputValues();
    const storePrice = getAmazonDisplayedPriceFromStore(asin);
    const sourcePriceUsd = storePrice.ok ? storePrice.sourcePriceUsd : positiveNumber(getDefaultSourcePrice());
    const price = sourcePriceUsd ? calculateSupplyPriceCny(sourcePriceUsd) : '';
    const stock = Number(getDefaultStock() || 15);
    const skuText = values.map((item) => item.text).find((text) => /^[A-Z0-9][A-Z0-9 -]{1,40}$/i.test(text) && !/请输入|please enter/i.test(text));
    const skuCode = asin || skuText || extractProductIdFromCurrentPage();
    return [{
      id: null,
      skuId: null,
      skuCode,
      gloGoodsValue: price || '',
      gloLogisticValue: 0,
      supplyPrice: price || '',
      specialProductTypeListJson: '',
      skuStockWareType: '',
      skuWarehouseStockListJson: '',
      sellableQuantity: stock,
      effectiveSupplyPrice: null,
      packageWeight: getDefaultWeightKg(),
      packageLength: getDefaultLength(),
      packageWidth: getDefaultWidth(),
      packageHeight: getDefaultHeight(),
      packageWeightUnit: null,
      status: 'active',
      skuPropertyListJson: JSON.stringify([{ ...US_SHIPS_FROM_PROPERTY }]),
      imageList: null,
      destCountrySupplyPriceListJson: '',
    }];
  }

  function buildDomProductSnapshot(editData) {
    if (!/\/web\/smtlocalProduct\/edit/i.test(location.pathname)) return null;
    const id = extractProductIdFromCurrentPage();
    const subject = extractSubjectFromCurrentEditPage();
    const sourceUrl = extractSourceUrlFromCurrentEditPage();
    const images = extractMainImagesFromCurrentEditPage();
    const detailText = subject ? `Product Description\n${subject}` : '';
    if (!subject && !sourceUrl && !images.length) return null;
    return {
      __domFallback: true,
      id,
      shopId: extractShopIdFromCurrentPage(),
      subject,
      sourceUrl,
      fullCid: '',
      categoryId: '',
      dxmState: 'draft',
      currencyCode: 'USD',
      mainImageListJson: JSON.stringify(images),
      detailWeb: detailText ? buildPcDetailWeb(detailText, images, subject) : '',
      detailMobile: JSON.stringify({
        moduleList: detailText ? [{ type: 'text', texts: [{ class: 'body', content: detailText }] }] : [],
        version: '2.0.0',
      }),
      variationList: extractEditPageSkuSnapshot(sourceUrl, subject),
      productPropertyListJson: '[]',
      postageId: getDefaultPostageId(),
      deliveryTime: '7',
      productUnit: '100000015',
      productId: null,
      __editDataKeys: editData && editData.data ? Object.keys(editData.data) : Object.keys(editData || {}),
    };
  }

  function isMetadataOnlyEditProduct(product) {
    if (!product || typeof product !== 'object') return true;
    const keys = Object.keys(product);
    if (!keys.length) return true;
    const productSignals = ['id', 'shopId', 'subject', 'sourceUrl', 'mainImageListJson', 'variationList', 'variationListStr'];
    return !productSignals.some((key) => isUsableValue(product[key]));
  }

  function normalizeJsonString(value, fallback) {
    if (value == null || value === '') return fallback == null ? '' : JSON.stringify(fallback);
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  }

  function firstNonEmpty(...values) {
    for (const value of values) {
      if (value !== undefined && value !== null && value !== '') return value;
    }
    return '';
  }

  function extractAsin(text) {
    const source = String(text || '');
    const direct = source.match(/\/dp\/([A-Z0-9]{10})(?:[/?]|$)/i) || source.match(/\b(B0[A-Z0-9]{8})\b/i);
    return direct ? direct[1].toUpperCase() : '';
  }

  function readAmazonPublicBatch() {
    try {
      const parsed = JSON.parse(localStorage.getItem(AMAZON_PUBLIC_BATCH_KEY) || '{}');
      return parsed && parsed.batch && Array.isArray(parsed.batch.items) ? parsed.batch : null;
    } catch (_) {
      return null;
    }
  }

  function getAmazonBatchItem(product) {
    const asin = extractAsin(`${product.sourceUrl || ''} ${product.sourceId || ''} ${product.platformProductId || ''} ${product.subject || ''}`);
    if (!asin) return null;
    const batch = readAmazonPublicBatch();
    if (!batch) return null;
    return (batch.items || []).find((item) => extractAsin(`${item.asin || ''} ${item.url || ''} ${item.rawUrl || ''}`) === asin) || null;
  }

  function getSelectedAmazonBatchItem(options = {}) {
    const batch = readAmazonPublicBatch();
    const items = batch && Array.isArray(batch.items) ? batch.items : [];
    const requestedAsin = extractAsin(getAmazonSourceAsin());
    const usableItems = items.filter((item) => item && extractAsin(`${item.asin || ''} ${item.url || ''} ${item.rawUrl || ''}`));
    let item = null;
    if (requestedAsin) {
      item = usableItems.find((entry) => extractAsin(`${entry.asin || ''} ${entry.url || ''} ${entry.rawUrl || ''}`) === requestedAsin) || null;
    }
    if (!item) {
      item = usableItems.find((entry) => entry.status === 'candidate' && entry.title && entry.image) ||
        usableItems.find((entry) => entry.title && entry.image) ||
        usableItems[0] ||
        null;
    }
    if (!item && !options.silent) {
      throw new Error('未读取到 Amazon 采集商品。请先在 Amazon 采集插件生成批次，或在 Amazon ASIN 输入框指定一个已采集 ASIN。');
    }
    return item;
  }

  function escapeRegExp(text) {
    return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function plainTextFromHtml(value) {
    return String(value || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizeSpaces(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function sanitizePlatformText(text) {
    return String(text || '')
      .replace(/(\d+(?:\.\d+)?)\s*(?:"|″|”|“|＂|''|′′)/g, '$1 inch')
      .replace(/(\d+(?:\.\d+)?)\s*in\.(?=\s|$|<|[),.;:!?])/gi, '$1 inch')
      .replace(/[“”„‟＂"]/g, '')
      .replace(/[′″‘’‚‛]/g, '')
      .replace(/\s+inch\b/gi, ' inch')
      .replace(/\binch\s+inch\b/gi, 'inch');
  }

  function sanitizePlatformTextDeep(value) {
    if (typeof value === 'string') return sanitizePlatformText(value);
    if (Array.isArray(value)) return value.map((item) => sanitizePlatformTextDeep(item));
    if (value && typeof value === 'object') {
      const output = {};
      for (const [key, item] of Object.entries(value)) output[key] = sanitizePlatformTextDeep(item);
      return output;
    }
    return value;
  }

  function sanitizeJsonTextFields(jsonText, fallback) {
    const parsed = parseMaybeJson(jsonText, fallback);
    return JSON.stringify(sanitizePlatformTextDeep(parsed));
  }

  function sanitizeHtmlTextContent(html) {
    const source = String(html || '');
    if (!source.includes('<')) return sanitizePlatformText(source);
    const root = document.createElement('div');
    root.innerHTML = source;
    const visit = (node) => {
      if (node.nodeType === 3) {
        node.nodeValue = sanitizePlatformText(node.nodeValue);
        return;
      }
      if (node.nodeType !== 1) return;
      for (const attr of ['alt', 'title']) {
        if (node.hasAttribute && node.hasAttribute(attr)) {
          node.setAttribute(attr, sanitizePlatformText(node.getAttribute(attr)));
        }
      }
      Array.from(node.childNodes || []).forEach(visit);
    };
    Array.from(root.childNodes || []).forEach(visit);
    return root.innerHTML;
  }

  function findPlatformTextIssues(text) {
    const source = String(text || '');
    const issues = [];
    if (/[“”„‟＂"′″‘’‚‛]/.test(source)) issues.push('contains_quote_or_dimension_symbol');
    if (/\d+(?:\.\d+)?\s*in\./i.test(source)) issues.push('contains_abbreviated_in_dot');
    return issues;
  }

  function truncateAtWord(text, maxLength) {
    const source = normalizeSpaces(text);
    if (source.length <= maxLength) return source;
    const truncated = source.slice(0, maxLength + 1);
    const boundary = truncated.lastIndexOf(' ');
    return normalizeSpaces((boundary > 40 ? truncated.slice(0, boundary) : source.slice(0, maxLength)).replace(/[,\-:;|]+$/g, ''));
  }

  function toSimpleTitleCase(text) {
    const lowerWords = new Set(['and', 'or', 'for', 'with', 'to', 'of', 'in', 'on', 'by', 'from']);
    return normalizeSpaces(text).split(' ').map((word, index) => {
      const clean = word.toLowerCase();
      if (index > 0 && lowerWords.has(clean)) return clean;
      return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : '';
    }).join(' ');
  }

  function collectBrandCandidates(item) {
    const candidates = [];
    if (!item || typeof item !== 'object') return candidates;
    for (const key of ['brand', 'brandName', 'brand_name', 'manufacturer', 'maker', 'sellerName']) {
      if (item[key]) candidates.push(String(item[key]));
    }
    const titleSource = String(firstNonEmpty(item.title, item.subject, ''));
    const titleTokens = normalizeSpaces(titleSource).split(/\s+/).filter(Boolean);
    const firstTitleToken = titleTokens[0] || '';
    const secondTitleToken = titleTokens[1] || '';
    if (/^[A-Z][A-Z0-9&.-]{1,20}$/.test(firstTitleToken)) candidates.push(firstTitleToken);
    if (/^[A-Z][A-Z0-9&.-]{1,20}$/.test(firstTitleToken) && /^[A-Z0-9][A-Z0-9.-]{1,20}$/i.test(secondTitleToken)) {
      candidates.push(`${firstTitleToken} ${secondTitleToken}`);
    }
    const genericLeadingWords = /^(home|kitchen|bathroom|office|desk|drawer|sink|soap|silicone|plastic|metal|wood|acrylic|glass|clear|black|white|wall|cable|cord|wire|adhesive|rotating|adjustable|foldable|portable)$/i;
    const productDescriptorAfterBrand = /^(silicone|plastic|metal|wood|acrylic|glass|soap|sink|drain|drawer|desk|pen|pencil|wall|adhesive|cable|cord|wire|hook|hooks|organizer|storage|tray|holder|dish|strainer)$/i;
    if (
      /^[A-Z][a-z0-9][A-Za-z0-9&.-]{2,24}$/.test(firstTitleToken)
      && !genericLeadingWords.test(firstTitleToken)
      && productDescriptorAfterBrand.test(secondTitleToken)
    ) {
      candidates.push(firstTitleToken);
    }
    const detailSource = `${item.detailTextSample || ''}\n${item.rawText || ''}`;
    const brandMatch = detailSource.match(/\bbrand\s*(?:name)?\s*[:：]\s*([^\n,;|]+)/i);
    if (brandMatch && brandMatch[1]) candidates.push(brandMatch[1]);
    return Array.from(new Set(candidates.map((value) => normalizeSpaces(value).replace(/[™®©]/g, '')).filter((value) => value && value.length <= 40)));
  }

  function stripForbiddenCommerceTerms(text, item) {
    let output = String(text || '').replace(/[™®©]/g, ' ');
    const terms = [...FORBIDDEN_COMMERCE_TERMS, ...collectBrandCandidates(item)].sort((a, b) => String(b).length - String(a).length);
    for (const term of terms) {
      if (!term) continue;
      output = output.replace(new RegExp(`\\b${escapeRegExp(term)}\\b`, 'gi'), ' ');
    }
    return normalizeSpaces(output.replace(/\b(?:brand|trademark|store)\s*(?:name)?\s*[:：][^,\n.;]+/gi, ' '));
  }

  function findForbiddenTitleTerms(text, item = null) {
    const source = String(text || '').toLowerCase();
    const terms = [...FORBIDDEN_COMMERCE_TERMS, ...collectBrandCandidates(item)];
    return Array.from(new Set(terms
      .map((term) => normalizeSpaces(term).replace(/[™®©]/g, ''))
      .filter(Boolean)
      .filter((term) => source.includes(term.toLowerCase()))));
  }

  function hasForbiddenCommerceTerms(text, item = null) {
    return findForbiddenTitleTerms(text, item).length > 0;
  }

  function fallbackProductTitle(item) {
    const source = `${item && item.title ? item.title : ''} ${item && item.categoryTerm ? item.categoryTerm : ''}`.toLowerCase();
    if (source.includes('sink') || source.includes('drain') || source.includes('strainer')) {
      return 'Kitchen Sink Drain Strainer Stopper for Home Use';
    }
    if (source.includes('organizer') || source.includes('storage')) {
      return 'Home Storage Organizer for Everyday Household Use';
    }
    if (source.includes('mat') || source.includes('rug')) {
      return 'Household Mat for Everyday Indoor Use';
    }
    return 'Home Utility Product for Everyday Use';
  }

  function buildCompliantProductTitle(originalTitle, item) {
    let title = sanitizePlatformText(firstNonEmpty(originalTitle, item && item.title, fallbackProductTitle(item)));
    for (let attempt = 0; attempt < 4; attempt += 1) {
      title = stripForbiddenCommerceTerms(title, item)
        .replace(/\([^)]*(?:amazon|official|brand|store|trademark)[^)]*\)/gi, ' ')
        .replace(/\[[^\]]*(?:amazon|official|brand|store|trademark)[^\]]*\]/gi, ' ')
        .replace(/\b(?:new|sale|deal|cheap|discount|must-have)\b/gi, ' ')
        .replace(/[|_/]+/g, ' ')
        .replace(/\s*[-:;]\s*/g, ' ');
      title = toSimpleTitleCase(title);
      title = truncateAtWord(title, EDIT_PAGE_RULES.titleMaxChars);
      if (!findForbiddenTitleTerms(title, item).length) break;
    }
    if (!title || findForbiddenTitleTerms(title, item).length) title = fallbackProductTitle(item);
    return sanitizePlatformText(title);
  }

  function inferMaterial(item) {
    const source = `${item && item.title ? item.title : ''} ${item && item.detailTextSample ? item.detailTextSample : ''}`.toLowerCase();
    if (source.includes('silicone')) return 'silicone';
    if (source.includes('stainless steel')) return 'stainless steel';
    if (source.includes('plastic')) return 'plastic';
    if (source.includes('metal')) return 'metal';
    if (source.includes('cotton')) return 'cotton';
    if (source.includes('polyester')) return 'polyester';
    return 'durable everyday material';
  }

  function buildCompliantPcDescription(item, compliantTitle) {
    const productName = buildCompliantProductTitle(compliantTitle, item);
    const material = inferMaterial(item);
    const usage = `${item && item.categoryTerm ? item.categoryTerm : 'home, kitchen, and everyday use'}`.toLowerCase();
    const lines = [
      `${productName} is designed for practical everyday use in U.S. homes, apartments, dorm rooms, offices, and light commercial spaces. The product focuses on simple function, easy handling, and a clean appearance without adding unnecessary decoration or complicated setup.`,
      'Key Details:',
      `- Material: made with ${material}, selected for regular handling, repeated use, and easy care during normal household routines.`,
      `- Function: helps organize, protect, cover, filter, drain, or support the related area based on the intended ${usage} application.`,
      '- Design: compact shape, smooth edges, and a simple structure make it easy to place, remove, clean, and store when not in use.',
      '- Daily Use: suitable for kitchens, utility areas, bathrooms, laundry rooms, storage spaces, and other common household settings.',
      '- Practical Advantage: provides a reusable solution for routine tasks while keeping the product easy to understand and simple to match with existing home items.',
    ];
    let description = sanitizePlatformText(stripForbiddenCommerceTerms(lines.join('\n'), item));
    while (plainTextFromHtml(description).length < EDIT_PAGE_RULES.pcDescriptionMinChars) {
      description += '\n- Additional Detail: built for straightforward daily use, with neutral styling and practical proportions that make it suitable for repeated handling in common home environments.';
      description = sanitizePlatformText(stripForbiddenCommerceTerms(description, item));
    }
    return description;
  }

  function buildDetailMobileFromText(text) {
    return JSON.stringify({
      moduleList: [{ type: 'text', texts: [{ class: 'body', content: text }] }],
      version: '2.0.0',
    });
  }

  function normalizeImageList(value) {
    const parsed = typeof value === 'string' ? parseMaybeJson(value, value) : value;
    const list = Array.isArray(parsed) ? parsed : [parsed];
    const urls = [];
    for (const item of list) {
      if (!item) continue;
      if (typeof item === 'string') {
        const nested = parseMaybeJson(item, null);
        if (Array.isArray(nested) || (nested && typeof nested === 'object')) {
          urls.push(...normalizeImageList(nested));
          continue;
        }
        if (item.includes('|')) urls.push(...item.split('|'));
        else urls.push(item);
        continue;
      }
      if (typeof item === 'object') {
        urls.push(item.url || item.imgUrl || item.image || item.src || item.imageUrl || '');
      }
    }
    return Array.from(new Set(urls.map((url) => String(url || '').trim()).filter(Boolean)));
  }

  function getCurrentEditMainImageUrls() {
    const product = getProductFromEdit(state.editData) || {};
    return normalizeImageList([
      product.mainImageListJson,
      product.mainImageList,
      product.imgList,
      product.imageList,
      product.mainImages,
      product.imgUrl,
      extractMainImagesFromCurrentEditPage(),
    ])
      .filter((url) => /^https?:\/\//i.test(url))
      .filter((url) => !/loading|addImg|logo|avatar|icon|sprite|data:image/i.test(url));
  }

  function selectMarketingImages(product, mainImages) {
    const generatedImages = normalizeImageList([
      product && product.marketImage1,
      product && product.marketImage2,
      product && product.marketImageListJson,
      product && product.marketingImages,
    ]);
    const sourceImages = generatedImages.length >= EDIT_PAGE_RULES.marketingImageCount ? generatedImages : normalizeImageList(mainImages);
    const selected = sourceImages.slice(0, EDIT_PAGE_RULES.marketingImageCount);
    while (selected.length === 1 && selected.length < EDIT_PAGE_RULES.marketingImageCount) selected.push(selected[0]);
    return {
      images: selected,
      source: generatedImages.length >= EDIT_PAGE_RULES.marketingImageCount ? 'one_key_generated_or_existing' : 'main_image_fallback',
      issue: selected.length < EDIT_PAGE_RULES.marketingImageCount
        ? '营销图片不足 2 张：一键生成或图片源未提供足够结果'
        : generatedImages.length >= EDIT_PAGE_RULES.marketingImageCount
          ? ''
          : '未检测到一键生成的 2 张营销图，已临时使用主图兜底；正式执行需优先一键生成',
    };
  }

  function buildAmazonVariationList(item) {
    const asin = extractAsin(`${item.asin || ''} ${item.url || ''} ${item.rawUrl || ''}`);
    const priceState = getStrictPriceState();
    const supplyPrice = priceState.ok ? priceState.supplyPrice : '';
    const dimensionsCm = item.dimensionsCm || dimensionsInToCm(item.dimensionsIn);
    const length = firstNonEmpty(dimensionsCm && dimensionsCm.length, inchToCm(getDefaultLengthIn()), getDefaultLength());
    const width = firstNonEmpty(dimensionsCm && dimensionsCm.width, inchToCm(getDefaultWidthIn()), getDefaultWidth());
    const height = firstNonEmpty(dimensionsCm && dimensionsCm.height, inchToCm(getDefaultHeightIn()), getDefaultHeight());
    return [{
      id: null,
      skuId: null,
      skuCode: asin,
      gloGoodsValue: supplyPrice ? Number(supplyPrice) : '',
      gloLogisticValue: 0,
      supplyPrice: supplyPrice ? Number(supplyPrice) : '',
      specialProductTypeListJson: '',
      skuStockWareType: '',
      skuWarehouseStockListJson: '',
      sellableQuantity: Number(getDefaultStock() || 15),
      effectiveSupplyPrice: null,
      packageWeight: firstNonEmpty(item.weightKg, getDefaultWeightKg()),
      packageLength: length,
      packageWidth: width,
      packageHeight: height,
      packageWeightUnit: null,
      status: 'active',
      skuPropertyListJson: JSON.stringify([{ ...US_SHIPS_FROM_PROPERTY }]),
      imageList: item.image ? [item.image] : null,
      destCountrySupplyPriceListJson: '',
    }];
  }

  function buildAmazonProductSnapshot(editData, options = {}) {
    const item = getSelectedAmazonBatchItem({ silent: true });
    if (!item) {
      if (!options.silent) getSelectedAmazonBatchItem();
      return null;
    }
    const asin = extractAsin(`${item.asin || ''} ${item.url || ''} ${item.rawUrl || ''}`);
    const sourceUrl = firstNonEmpty(item.url, item.rawUrl, asin ? `https://www.amazon.com/dp/${asin}` : '');
    const title = buildCompliantProductTitle(String(firstNonEmpty(item.title, asin ? `Product ${asin}` : '')).trim(), item);
    const detailText = buildCompliantPcDescription(item, title);
    const images = normalizeImageList([item.images, item.imageList, item.image]);
    const marketingSelection = selectMarketingImages(item, images);
    return {
      __amazonSource: true,
      __sourceMode: 'amazon_crawlbox_empty_form',
      __editDataKeys: editData && editData.data ? Object.keys(editData.data) : Object.keys(editData || {}),
      id: extractProductIdFromCurrentPage(),
      shopId: extractShopIdFromCurrentPage(),
      categoryId: '',
      fullCid: '',
      subject: title,
      sourceUrl,
      sourceId: asin,
      platformProductId: asin,
      sourceCategoryName: item.categoryTerm || '',
      categoryName: item.categoryTerm || '',
      dxmState: 'draft',
      currencyCode: 'USD',
      minPrice: '',
      maxPrice: '',
      mainImageListJson: JSON.stringify(images),
      marketImage1: marketingSelection.images[0] || '',
      marketImage2: marketingSelection.images[1] || '',
      detailWeb: detailText ? buildPcDetailWeb(detailText, images, title) : '',
      detailMobile: detailText ? buildDetailMobileFromText(detailText) : JSON.stringify({ moduleList: [], version: '2.0.0' }),
      variationList: buildAmazonVariationList(item),
      productPropertyListJson: '[]',
      postageId: getDefaultPostageId(),
      deliveryTime: '7',
      productUnit: '100000015',
      productId: null,
      optionValues: ensureUsShipFromOptionValues({}),
      optionValueIds: ensureUsShipFromOptionValueIds({}),
      shipFrom: 'United States',
    };
  }

  function buildAmazonEditDataContext() {
    const product = buildAmazonProductSnapshot({}, { silent: false });
    return {
      code: 0,
      msg: 'amazon crawlbox source',
      data: {
        product,
        categoryTree: [],
        unitList: [],
      },
      sourceMode: 'amazon_crawlbox_empty_form',
      createdAt: nowIso(),
    };
  }

  function positiveNumber(value) {
    const number = toNumber(value);
    return number != null && number > 0 ? number : null;
  }

  function parseDimensionInches(text) {
    const source = String(text || '').replace(/\s+/g, ' ');
    const match = source.match(/(?:Product|Item|Package)?\s*Dimensions[^0-9]{0,30}([0-9.]+)\s*[x脳]\s*([0-9.]+)\s*[x脳]\s*([0-9.]+)\s*(?:inches|inch|in\b|")/i)
      || source.match(/\b([0-9.]+)\s*[x脳]\s*([0-9.]+)\s*[x脳]\s*([0-9.]+)\s*(?:inches|inch|in\b|")/i);
    if (!match) return null;
    return { length: Number(match[1]), width: Number(match[2]), height: Number(match[3]) };
  }

  function dimensionsInToCm(dimensionsIn) {
    if (!dimensionsIn) return null;
    return {
      length: round2(Number(dimensionsIn.length) * 2.54),
      width: round2(Number(dimensionsIn.width) * 2.54),
      height: round2(Number(dimensionsIn.height) * 2.54),
    };
  }

  function parseWeightKg(text) {
    const source = String(text || '').replace(/\s+/g, ' ');
    const match = source.match(/(?:Item|Package)?\s*Weight[^0-9]{0,30}([0-9.]+)\s*(pounds|pound|lbs|lb|ounces|ounce|oz|kilograms|kilogram|kg|g|grams)/i)
      || source.match(/\b([0-9.]+)\s*(pounds|pound|lbs|lb|ounces|ounce|oz|kilograms|kilogram|kg|g|grams)\b/i);
    if (!match) return '';
    const value = Number(match[1]);
    const unit = String(match[2] || '').toLowerCase();
    if (!Number.isFinite(value)) return '';
    if (['pounds', 'pound', 'lbs', 'lb'].includes(unit)) return String(round2(value * 0.453592));
    if (['ounces', 'ounce', 'oz'].includes(unit)) return String(round2(value * 0.0283495));
    if (['g', 'grams'].includes(unit)) return String(round2(value / 1000));
    return String(round2(value));
  }

  function productTextForMetadata(product) {
    return [
      product.subject,
      product.platformTitle,
      product.platformShortDescription,
      product.platformOtherInfo,
      product.platformDescription,
      product.detailWeb,
      product.detailMobile,
    ].filter(Boolean).join(' ');
  }

  function toNumber(value) {
    if (value == null || value === '') return null;
    const parsed = Number(String(value).replace(/[^\d.]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function round2(value) {
    return Math.round(Number(value) * 100) / 100;
  }

  function inchToCm(value) {
    const number = toNumber(value);
    return number == null ? '' : String(round2(number * 2.54));
  }

  function calculateSupplyPriceCny(sourcePriceUsd) {
    const price = toNumber(sourcePriceUsd);
    if (price == null) return '';
    const exchangeRate = toNumber(getTaskExchangeRate());
    const taskMultiplier = toNumber(getTaskPriceMultiplier());
    if (exchangeRate == null || taskMultiplier == null) return '';
    return String(round2(price * exchangeRate * taskMultiplier));
  }

  function readAmazonPriceStoreFromBrowser() {
    const rawSources = [
      localStorage.getItem(AMAZON_PRICE_STORE_KEY) || '',
      window.__DXM_AMAZON_PRICE_STORE__ || '',
      document.getElementById('dxm-amazon-price-store-json')?.textContent || '',
    ].filter((value) => value !== undefined && value !== null && value !== '');
    for (const raw of rawSources) {
      const store = parseMaybeJson(raw, null);
      if (
        store
        && store.schemaVersion === AMAZON_PRICE_STORE_SCHEMA_VERSION
        && store.records
        && typeof store.records === 'object'
        && !Array.isArray(store.records)
      ) {
        return { ok: true, store };
      }
    }
    return { ok: false, reason: `Amazon price store missing in localStorage key ${AMAZON_PRICE_STORE_KEY}` };
  }

  function getCurrentEditAsinForPrice(product = null) {
    const rawData = state.editData && state.editData.data ? state.editData.data : state.editData;
    const sourceProduct = product || (
      rawData &&
      (rawData.product || rawData.smtLocalProduct || rawData.localProduct || rawData)
    ) || {};
    const titleInput = findProductTitleInput();
    const titleText = titleInput ? getInputText(titleInput) : '';
    return extractAsin([
      sourceProduct.sourceUrl,
      sourceProduct.url,
      extractSourceUrlFromCurrentEditPage(),
      sourceProduct.asin,
      sourceProduct.sourceId,
      sourceProduct.platformProductId,
      sourceProduct.subject,
      titleText,
      getAmazonSourceAsin(),
      location.href,
    ].filter(Boolean).join(' '));
  }

  function getAmazonDisplayedPriceFromStore(asin) {
    const normalized = extractAsin(asin);
    if (!normalized) return { ok: false, reason: 'missing_asin_for_price_lookup', asin: '' };
    const storeStatus = readAmazonPriceStoreFromBrowser();
    if (!storeStatus.ok) return { ok: false, reason: storeStatus.reason, asin: normalized };
    const record = storeStatus.store.records[normalized] || null;
    const price = positiveNumber(record && (record.amazonDisplayedPriceUsd || record.amazonOriginalPriceUsd));
    if (!record) return { ok: false, reason: 'amazon_displayed_price_missing', asin: normalized, storeUpdatedAt: storeStatus.store.updatedAt || '' };
    if (record.status !== 'trusted' || !price) {
      return { ok: false, reason: `amazon_displayed_price_not_trusted: ${record.status || 'missing'}`, asin: normalized, storeUpdatedAt: storeStatus.store.updatedAt || '' };
    }
    return { ok: true, asin: normalized, sourcePriceUsd: price, record, storeUpdatedAt: storeStatus.store.updatedAt || '' };
  }

  function inferSourcePrice(product, amazonItem = null) {
    return positiveNumber(getDefaultSourcePrice());
  }

  function getStrictPriceState() {
    const asin = getCurrentEditAsinForPrice();
    const storePrice = getAmazonDisplayedPriceFromStore(asin);
    const sourcePriceUsd = storePrice.ok ? storePrice.sourcePriceUsd : positiveNumber(getDefaultSourcePrice());
    const exchangeRate = positiveNumber(getTaskExchangeRate());
    const multiplier = positiveNumber(getTaskPriceMultiplier());
    const supplyPrice = sourcePriceUsd && exchangeRate && multiplier
      ? String(round2(sourcePriceUsd * exchangeRate * multiplier))
      : '';
    const missing = [];
    if (!sourcePriceUsd) missing.push('Amazon 页面展示价格 USD');
    if (!exchangeRate) missing.push('任务汇率');
    if (!multiplier) missing.push('任务倍率');
    return {
      ok: Boolean(sourcePriceUsd && exchangeRate && multiplier && supplyPrice),
      source: storePrice.ok ? 'amazon_price_store_displayed_price' : 'task_amazon_displayed_price_usd_fallback',
      asin,
      sourcePriceUsd,
      exchangeRate,
      multiplier,
      supplyPrice,
      formula: 'Amazon 页面展示价格 × 任务汇率 × 任务倍率',
      blockedSources: [
        'dianxiaomi_edit_page_price',
        'minPrice',
        'maxPrice',
        'ui_display_price',
        'page_cache_price',
        'manual_supply_price_override',
      ],
      priceStore: {
        ok: storePrice.ok,
        reason: storePrice.reason || '',
        updatedAt: storePrice.storeUpdatedAt || '',
      },
      reason: missing.length ? `缺少${missing.join('/')}` : '',
    };
  }

  function priceEqualsExpected(value, expected) {
    const actual = toNumber(value);
    const target = toNumber(expected);
    return actual != null && target != null && Math.abs(actual - target) < 0.01;
  }

  function inferAmazonDimensionsCm(product, amazonItem = null) {
    if (amazonItem && amazonItem.dimensionsCm) return amazonItem.dimensionsCm;
    const fromItemIn = amazonItem && amazonItem.dimensionsIn ? amazonItem.dimensionsIn : null;
    if (fromItemIn) return dimensionsInToCm(fromItemIn);
    const fromProductIn = parseDimensionInches(productTextForMetadata(product));
    return dimensionsInToCm(fromProductIn);
  }

  function inferAmazonWeightKg(product, amazonItem = null) {
    if (amazonItem && positiveNumber(amazonItem.weightKg)) return String(positiveNumber(amazonItem.weightKg));
    return parseWeightKg(productTextForMetadata(product));
  }

  function getProductFromEdit(editData) {
    const product = (
      editData &&
      editData.data &&
      (editData.data.product || editData.data.smtLocalProduct || editData.data.localProduct || editData.data)
    );
    if (isMetadataOnlyEditProduct(product)) {
      return buildDomProductSnapshot(editData) || buildAmazonProductSnapshot(editData, { silent: true }) || product;
    }
    return product;
  }

  function assertDraftProductForMainFlow(editData) {
    const product = getProductFromEdit(editData) || {};
    const dxmState = product.dxmState || '';
    const dxmOfflineState = product.dxmOfflineState || '';
    const productState = product.productState || '';
    const isWaitPublish = dxmState === 'offline' && dxmOfflineState === 'waitPublish';
    const isPublishFail = dxmState === 'offline' && dxmOfflineState === 'publishFail';
    if (isWaitPublish) {
      throw new Error('\u5f53\u524d\u4ea7\u54c1\u5df2\u5728\u5f85\u53d1\u5e03\u72b6\u6001\uff0c\u91c7\u96c6\u7bb1 op=1 \u4e0d\u80fd\u518d\u6b21\u79fb\u5165\u5f85\u53d1\u5e03\u3002\u8bf7\u6362\u4e00\u6761\u91c7\u96c6\u7bb1\u8349\u7a3f\u4ea7\u54c1\uff1b\u5f85\u53d1\u5e03\u72b6\u6001\u9700\u8981\u53e6\u6293\u9875\u9762\u4fdd\u5b58 payload \u5b66\u4e60\u4fdd\u5b58\u7ed3\u6784\u3002');
    }
    if (isPublishFail) {
      throw new Error('\u5f53\u524d\u4ea7\u54c1\u5728\u53d1\u5e03\u5931\u8d25\u5217\u8868\uff0c\u4e0d\u5c5e\u4e8e\u91c7\u96c6\u7bb1\u8349\u7a3f\u4e3b\u6d41\u7a0b\u3002\u8bf7\u6362\u4e00\u6761\u91c7\u96c6\u7bb1\u8349\u7a3f\u4ea7\u54c1\uff0c\u6216\u5148\u6293\u53d1\u5e03\u5931\u8d25\u72b6\u6001\u7684\u9875\u9762\u4fdd\u5b58 payload\u3002');
    }
    if (dxmState && dxmState !== 'draft') {
      throw new Error(`\u5f53\u524d\u4ea7\u54c1\u72b6\u6001\u4e0d\u662f\u91c7\u96c6\u7bb1\u8349\u7a3f\uff1adxmState=${dxmState}, dxmOfflineState=${dxmOfflineState}, productState=${productState}`);
    }
  }

  function parseMaybeJson(value, fallback) {
    if (value == null || value === '') return fallback;
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch (_) {
      return fallback;
    }
  }

  function mergeRequiredProperties(currentProperties, requiredProperties) {
    const current = Array.isArray(currentProperties) ? currentProperties.slice() : [];
    const required = Array.isArray(requiredProperties) ? requiredProperties : [];
    const requiredIds = new Set(required.map((item) => String(item.attr_name_id)));
    const kept = current.filter((item) => item && !requiredIds.has(String(item.attr_name_id)));
    return kept.concat(required.map((item) => ({ ...item })));
  }

  function findMissingRequiredPropertyNames(properties, requiredProperties) {
    if (!Array.isArray(requiredProperties) || !requiredProperties.length) return [];
    const propertyIds = new Set((Array.isArray(properties) ? properties : []).map((item) => String(item && item.attr_name_id)));
    return requiredProperties
      .filter((item) => !propertyIds.has(String(item.attr_name_id)))
      .map((item) => item.attr_name || item.attr_name_id);
  }

  function ensureUsShipsFromOnSku(sku) {
    const parsed = parseMaybeJson(sku.skuPropertyListJson, []);
    const list = Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    const withoutShipsFrom = list.filter((item) => String(item.sku_property_id) !== US_SHIPS_FROM_PROPERTY.sku_property_id);
    sku.skuPropertyListJson = JSON.stringify(withoutShipsFrom.concat([{ ...US_SHIPS_FROM_PROPERTY }]));
    return withoutShipsFrom.length !== list.length ? 'replaced' : 'added';
  }

  function hasUsShipsFromOnSku(sku) {
    const parsed = parseMaybeJson(sku && sku.skuPropertyListJson, []);
    if (!Array.isArray(parsed)) return false;
    return parsed.some(
      (item) =>
        String(item && item.sku_property_id) === US_SHIPS_FROM_PROPERTY.sku_property_id &&
        /united states/i.test(String(item && item.sku_property_value))
    );
  }

  function ensureUsShipFromOptionValues(rawOptionValues) {
    const optionValues = parseMaybeJson(rawOptionValues, {});
    const normalized = optionValues && typeof optionValues === 'object' && !Array.isArray(optionValues) ? optionValues : {};
    normalized['\u53d1\u8d27\u5730'] = ['United States'];
    normalized['Ships From'] = ['United States'];
    return normalized;
  }

  function ensureUsShipFromOptionValueIds(rawOptionValueIds) {
    const optionValueIds = parseMaybeJson(rawOptionValueIds, {});
    const normalized = optionValueIds && typeof optionValueIds === 'object' && !Array.isArray(optionValueIds) ? optionValueIds : {};
    normalized['\u53d1\u8d27\u5730'] = [US_SHIPS_FROM_PROPERTY.property_value_id];
    normalized['Ships From'] = [US_SHIPS_FROM_PROPERTY.property_value_id];
    return normalized;
  }

  function hasUsShipFromOptionValues(rawOptionValues, rawOptionValueIds) {
    const optionValuesText = JSON.stringify(parseMaybeJson(rawOptionValues, {})).toLowerCase();
    const optionValueIdsText = JSON.stringify(parseMaybeJson(rawOptionValueIds, {}));
    return optionValuesText.includes('united states') || optionValueIdsText.includes(US_SHIPS_FROM_PROPERTY.property_value_id);
  }

  function isBlank(value) {
    return value === undefined || value === null || value === '';
  }

  function setIfBlank(target, keys, value) {
    if (isBlank(value)) return false;
    let changed = false;
    for (const key of keys) {
      if (isBlank(target[key])) {
        target[key] = value;
        changed = true;
      }
    }
    return changed;
  }

  function setAlways(target, keys, value) {
    if (isBlank(value)) return false;
    let changed = false;
    for (const key of keys) {
      if (target[key] !== value) {
        target[key] = value;
        changed = true;
      }
    }
    return changed;
  }

  function ensureSkuCommercialFields(sku, defaults) {
    let changed = false;
    changed = setAlways(sku, ['skuCode', 'sku_code', 'merchantSku', 'sku'], defaults.skuCode) || changed;
    changed = setAlways(
      sku,
      ['gloGoodsValue', 'goodsValue', 'skuGoodsValue', 'skuValue', 'supplyPrice', 'countrySupplyPrice'],
      defaults.supplyPrice
    ) || changed;
    changed = setAlways(sku, ['gloLogisticValue', 'logisticValue', 'freight', 'freightPrice', 'skuFreight'], 0) || changed;
    changed = setAlways(sku, ['sellableQuantity', 'inventory', 'skuStock', 'stock', 'skuStockNum'], defaults.stock) || changed;
    changed = setAlways(sku, ['packageWeight', 'weight', 'skuWeight'], defaults.weight) || changed;
    changed = setAlways(sku, ['packageLength', 'length', 'skuLength'], defaults.length) || changed;
    changed = setAlways(sku, ['packageWidth', 'width', 'skuWidth'], defaults.width) || changed;
    changed = setAlways(sku, ['packageHeight', 'height', 'skuHeight'], defaults.height) || changed;
    return changed;
  }

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function textToDetailWeb(text) {
    return escapeHtml(text)
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map((line) => line.trim())
      .join('<br>\n');
  }

  function selectPcDetailImages(images) {
    return normalizeImageList(images)
      .filter((url) => /^https?:\/\//i.test(url))
      .filter((url) => !/logo|avatar|icon|sprite|data:image/i.test(url))
      .slice(0, EDIT_PAGE_RULES.pcDescriptionMaxImages);
  }

  function textToStructuredDetailBodyHtml(text) {
    const lines = String(text || '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const html = [];
    let inList = false;
    const closeList = () => {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
    };
    for (const line of lines) {
      if (/^[-*]\s+/.test(line)) {
        if (!inList) {
          html.push('<ul>');
          inList = true;
        }
        html.push(`<li>${escapeHtml(line.replace(/^[-*]\s+/, ''))}</li>`);
        continue;
      }
      closeList();
      if (/^[A-Z][A-Za-z ]{2,}:$/.test(line)) {
        html.push(`<h3>${escapeHtml(line.replace(/:$/, ''))}</h3>`);
      } else {
        html.push(`<p>${escapeHtml(line)}</p>`);
      }
    }
    closeList();
    return html.join('\n');
  }

  function buildPcDetailWeb(text, images, altText) {
    const selectedImages = selectPcDetailImages(images);
    const alt = escapeHtml(sanitizePlatformText(altText || 'Product image'));
    const imageHtml = selectedImages
      .map((url) => {
        const safeUrl = escapeHtml(url);
        return `<p><img src="${safeUrl}" alt="${alt}" style="max-width:100%;height:auto;display:block;margin:0 auto 12px;"></p>`;
      })
      .join('\n');
    const bodyHtml = textToStructuredDetailBodyHtml(text);
    return [imageHtml, bodyHtml].filter(Boolean).join('\n');
  }

  function normalizeImageUrlForCompare(url) {
    return String(url || '').trim().replace(/\?.*$/, '');
  }

  function getDetailWebImageUrls(detailWeb) {
    const root = document.createElement('div');
    root.innerHTML = String(detailWeb || '');
    return Array.from(root.querySelectorAll('img'))
      .map((img) => img.currentSrc || img.src || img.getAttribute('src') || '')
      .filter(Boolean);
  }

  function countLeadingImageBlocks(detailWeb) {
    const root = document.createElement('div');
    root.innerHTML = String(detailWeb || '');
    let count = 0;
    for (const node of Array.from(root.childNodes || [])) {
      if (node.nodeType === 3 && !String(node.nodeValue || '').trim()) continue;
      if (node.nodeType !== 1) break;
      const text = String(node.textContent || '').trim();
      const images = node.querySelectorAll ? node.querySelectorAll('img') : [];
      if (images.length && !text) {
        count += images.length;
        continue;
      }
      if (node.tagName === 'IMG') {
        count += 1;
        continue;
      }
      break;
    }
    return count;
  }

  function analyzePcDetailWebImages(detailWeb, currentImages) {
    const detailImages = getDetailWebImageUrls(detailWeb);
    const currentSet = new Set(selectPcDetailImages(currentImages).map(normalizeImageUrlForCompare));
    const currentProductImageCount = detailImages
      .map(normalizeImageUrlForCompare)
      .filter((url) => currentSet.has(url)).length;
    return {
      imageCount: detailImages.length,
      currentProductImageCount,
      leadingImageCount: countLeadingImageBlocks(detailWeb),
      required: EDIT_PAGE_RULES.pcDescriptionMinImages,
    };
  }

  function extractTextFromDetailMobile(detailMobile) {
    const parsed = parseMaybeJson(detailMobile, null);
    if (!parsed || !Array.isArray(parsed.moduleList)) return '';
    const lines = [];
    for (const module of parsed.moduleList) {
      if (module.type === 'text' && Array.isArray(module.texts)) {
        for (const textItem of module.texts) {
          if (textItem && textItem.content) lines.push(String(textItem.content));
        }
      }
    }
    return lines.join('\n\n').trim();
  }

  function isUsableValue(value) {
    if (value === undefined || value === null || value === '') return false;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }

  function findDeepByKeys(root, keys, maxDepth = 8) {
    const queue = [{ value: root, path: '', depth: 0 }];
    const seen = new Set();
    while (queue.length) {
      const item = queue.shift();
      const value = item.value;
      if (!value || typeof value !== 'object' || item.depth > maxDepth) continue;
      if (seen.has(value)) continue;
      seen.add(value);

      for (const key of Object.keys(value)) {
        const child = value[key];
        if (keys.includes(key) && isUsableValue(child)) {
          return { value: child, path: item.path ? `${item.path}.${key}` : key };
        }
        if (child && typeof child === 'object') {
          queue.push({
            value: child,
            path: item.path ? `${item.path}.${key}` : key,
            depth: item.depth + 1,
          });
        }
      }
    }
    return { value: '', path: '' };
  }

  function deepValue(editData, product, keys) {
    for (const key of keys) {
      if (product && isUsableValue(product[key])) return { value: product[key], path: `product.${key}` };
    }
    return findDeepByKeys(editData, keys);
  }

  function buildPayloadFromEdit(editData) {
    const product = getProductFromEdit(editData);
    if (!product || typeof product !== 'object') {
      throw new Error('edit.json \u672a\u627e\u5230 product \u5bf9\u8c61');
    }

    const found = {
      mainImages: deepValue(editData, product, ['mainImageListJson', 'mainImageList', 'imgList', 'imageList', 'mainImages']),
      variations: deepValue(editData, product, ['variationListStr', 'variationList', 'skuList', 'variations', 'skuInfoList']),
      properties: deepValue(editData, product, [
        'productPropertyListJson',
        'productPropertyList',
        'propertyList',
        'productProperties',
        'aeopAeProductPropertys',
        'attributeList',
      ]),
      postageId: deepValue(editData, product, ['postageId', 'freightTemplateId', 'shippingTemplateId', 'templateId']),
      deliveryTime: deepValue(editData, product, ['deliveryTime', 'delivery_time']),
      detailMobile: deepValue(editData, product, ['detailMobile', 'mobileDetail', 'mobileDesc']),
      detailWeb: deepValue(editData, product, ['detailWeb', 'description', 'detail', 'productDetail']),
      categoryId: deepValue(editData, product, ['categoryId', 'category_id', 'cateId']),
      optionValues: deepValue(editData, product, ['optionValues', 'optionValueMap']),
      optionValueIds: deepValue(editData, product, ['optionValueIds', 'optionValueIdMap']),
      shipFrom: deepValue(editData, product, ['shipFrom']),
    };

    const payload = {};
    for (const field of SAVE_FIELDS) {
      payload[field] = product[field] === undefined ? null : product[field];
    }

    payload.id = String(firstNonEmpty(product.id, product.productId, state.productId));
    payload.shopId = String(firstNonEmpty(product.shopId, product.shop_id, extractShopIdFromCurrentPage()));
    payload.categoryId = String(firstNonEmpty(found.categoryId.value, product.fullCid));
    payload.subject = String(firstNonEmpty(product.subject, product.title, product.productTitle));
    payload.sourceUrl = firstNonEmpty(product.sourceUrl, product.url, '');
    payload.fullCid = firstNonEmpty(product.fullCid, '');
    payload.productPropertyListJson = normalizeJsonString(found.properties.value, []);
    payload.mainImageListJson = normalizeJsonString(found.mainImages.value, []);
    payload.variationListStr = normalizeJsonString(found.variations.value, []);
    const mainImagesForMarketing = normalizeImageList(payload.mainImageListJson);
    const marketingSelection = selectMarketingImages(product, mainImagesForMarketing);
    payload.optionValues = JSON.stringify(ensureUsShipFromOptionValues(found.optionValues.value));
    payload.optionValueIds = JSON.stringify(ensureUsShipFromOptionValueIds(firstNonEmpty(found.optionValueIds.value, product.optionValueIds)));
    payload.shipFrom = firstNonEmpty(found.shipFrom.value, product.shipFrom, 'United States');
    payload.videoListJson = product.videoListJson == null ? null : normalizeJsonString(product.videoListJson, []);
    payload.sizeChartIdListJson = product.sizeChartIdListJson == null ? '' : normalizeJsonString(product.sizeChartIdListJson, []);
    payload.aeopQualificationStructListJson = normalizeJsonString(
      firstNonEmpty(product.aeopQualificationStructListJson, product.aeopQualificationStructList),
      []
    );
    payload.imgUrl = firstNonEmpty(
      product.imgUrl,
      mainImagesForMarketing.join('|')
    );
    payload.marketImage1 = marketingSelection.images[0] || '';
    payload.marketImage2 = marketingSelection.images[1] || '';
    payload.productUnit = firstNonEmpty(product.productUnit, product.unit, '100000015');
    payload.packageType = 0;
    payload.lotNum = '';
    payload.supportCountrySupplyPrice = firstNonEmpty(product.supportCountrySupplyPrice, 0);
    payload.sizeChartId = firstNonEmpty(product.sizeChartId, '');
    payload.detailMobile = normalizeJsonString(found.detailMobile.value, {});
    payload.detailWeb = String(firstNonEmpty(found.detailWeb.value, product.detailWeb, ''));
    const fallbackWebText = extractTextFromDetailMobile(payload.detailMobile);
    const detailWebDerived = !payload.detailWeb && fallbackWebText;
    if (detailWebDerived) {
      payload.detailWeb = buildPcDetailWeb(fallbackWebText, mainImagesForMarketing, payload.subject);
    }
    payload.deliveryTime = String(firstNonEmpty(found.deliveryTime.value, '7'));
    payload.postageId = String(firstNonEmpty(found.postageId.value, ''));
    payload.manufactureId = firstNonEmpty(product.manufactureId, '');
    payload.msrEuId = product.msrEuId == null ? -2 : product.msrEuId;
    payload.msrTrId = product.msrTrId == null ? -2 : product.msrTrId;
    payload.op = 2;
    payload.currencyCode = firstNonEmpty(product.currencyCode, 'USD');
    payload.dxmState = firstNonEmpty(product.dxmState, 'draft');
    payload.productId = product.productId == null ? null : product.productId;
    const defaultRulesApplied = [];
    const asin = extractAsin(`${product.sourceUrl || ''} ${product.sourceId || ''} ${product.platformProductId || ''} ${product.subject || ''}`);
    const amazonItem = getAmazonBatchItem(product);
    const complianceSource = amazonItem || product;
    const compliantTitle = buildCompliantProductTitle(payload.subject, complianceSource);
    if (compliantTitle && compliantTitle !== payload.subject) {
      payload.subject = compliantTitle;
      defaultRulesApplied.push(`标题已按编辑页规则重写，长度 ${payload.subject.length}/${EDIT_PAGE_RULES.titleMaxChars}`);
    }
    const detailImageStateBefore = analyzePcDetailWebImages(payload.detailWeb, mainImagesForMarketing);
    const detailPlainText = plainTextFromHtml(payload.detailWeb) || extractTextFromDetailMobile(payload.detailMobile);
    if (
      !detailPlainText ||
      detailPlainText.length < EDIT_PAGE_RULES.pcDescriptionMinChars ||
      hasForbiddenCommerceTerms(detailPlainText) ||
      detailImageStateBefore.currentProductImageCount < EDIT_PAGE_RULES.pcDescriptionMinImages ||
      detailImageStateBefore.leadingImageCount < EDIT_PAGE_RULES.pcDescriptionMinImages
    ) {
      const compliantDescription = buildCompliantPcDescription(complianceSource, payload.subject);
      payload.detailWeb = buildPcDetailWeb(compliantDescription, mainImagesForMarketing, payload.subject);
      payload.detailMobile = buildDetailMobileFromText(compliantDescription);
      defaultRulesApplied.push(
        `PC端描述已按规则重写为先图片后描述，字符数 ${plainTextFromHtml(compliantDescription).length}/${EDIT_PAGE_RULES.pcDescriptionMinChars}，当前商品图片 ${selectPcDetailImages(mainImagesForMarketing).length}`
      );
    }
    if (payload.postageId !== EDIT_PAGE_RULES.postageTemplateId) {
      payload.postageId = EDIT_PAGE_RULES.postageTemplateId;
      defaultRulesApplied.push(`运费模板已固定为 ${EDIT_PAGE_RULES.postageTemplateId}`);
    }
    const beforeSanitizeSubject = payload.subject;
    payload.subject = sanitizePlatformText(payload.subject);
    payload.detailWeb = sanitizeHtmlTextContent(payload.detailWeb);
    payload.detailMobile = sanitizeJsonTextFields(payload.detailMobile, {});
    payload.productPropertyListJson = sanitizeJsonTextFields(payload.productPropertyListJson, []);
    payload.variationListStr = sanitizeJsonTextFields(payload.variationListStr, []);
    if (payload.subject !== beforeSanitizeSubject) {
      defaultRulesApplied.push('发布前字符清洗：标题中的引号/尺寸符号已替换或删除');
    }
    if (marketingSelection.issue) {
      defaultRulesApplied.push(marketingSelection.issue);
    } else {
      defaultRulesApplied.push(`营销图片已固定选择 ${EDIT_PAGE_RULES.marketingImageCount} 张`);
    }
    const variationsParsed = parseMaybeJson(payload.variationListStr, []);
    const inferredAmazonWeightKg = inferAmazonWeightKg(product, amazonItem);
    const inferredAmazonDimensionsCm = inferAmazonDimensionsCm(product, amazonItem);
    const defaultWeightKg = firstNonEmpty(inferredAmazonWeightKg, getDefaultWeightKg());
    const defaultPostageId = getDefaultPostageId();
    const defaultStock = getDefaultStock();
    const inferredSourcePrice = inferSourcePrice(product, amazonItem);
    const calculatedSupplyPrice = calculateSupplyPriceCny(inferredSourcePrice);
    const priceState = getStrictPriceState();
    const effectiveSupplyPrice = priceState.ok ? calculatedSupplyPrice : '';
    const defaultLength = firstNonEmpty(inferredAmazonDimensionsCm && inferredAmazonDimensionsCm.length, inchToCm(getDefaultLengthIn()), getDefaultLength());
    const defaultWidth = firstNonEmpty(inferredAmazonDimensionsCm && inferredAmazonDimensionsCm.width, inchToCm(getDefaultWidthIn()), getDefaultWidth());
    const defaultHeight = firstNonEmpty(inferredAmazonDimensionsCm && inferredAmazonDimensionsCm.height, inchToCm(getDefaultHeightIn()), getDefaultHeight());
    const valueSources = {
      sourcePriceUsd: priceState.ok ? 'task_amazon_original_price_usd' : 'blocked_missing_task_amazon_original_price',
      supplyPriceCny: priceState.ok ? 'task_formula_only' : 'blocked',
      blockedPriceSources: priceState.blockedSources,
      stock: 'task_config',
      skuCode: asin ? 'amazon_asin' : 'fallback_product_id',
      weight: inferredAmazonWeightKg ? 'amazon_detail_or_edit_metadata' : 'default_missing_amazon_weight',
      dimensions: inferredAmazonDimensionsCm ? 'amazon_detail_or_edit_metadata' : getDefaultLengthIn() || getDefaultWidthIn() || getDefaultHeightIn()
        ? 'task_inches_converted_to_cm'
        : 'default_or_task_cm',
      taskFormula: {
        exchangeRate: getTaskExchangeRate(),
        multiplier: getTaskPriceMultiplier(),
      },
    };
    const skuDefaults = {
      skuCode: asin,
      supplyPrice: effectiveSupplyPrice ? Number(effectiveSupplyPrice) : '',
      stock: Number(defaultStock || 15),
      weight: defaultWeightKg,
      length: defaultLength,
      width: defaultWidth,
      height: defaultHeight,
    };
    const categoryDefault = getDefaultPropertiesForProduct(payload, product);
    if (categoryDefault.publishCategoryId && payload.categoryId !== categoryDefault.publishCategoryId) {
      payload.categoryId = categoryDefault.publishCategoryId;
      defaultRulesApplied.push(`\u5df2\u6309 Bumpers \u7c7b\u89c4\u5219\u6620\u5c04\u53d1\u5e03\u7c7b\u76ee ${payload.categoryId}`);
    }
    if (categoryDefault.properties) {
      const beforeProperties = parseMaybeJson(payload.productPropertyListJson, []);
      const missingBefore = findMissingRequiredPropertyNames(beforeProperties, categoryDefault.properties);
      payload.categoryId = categoryDefault.publishCategoryId || payload.categoryId;
      payload.productPropertyListJson = JSON.stringify(mergeRequiredProperties(beforeProperties, categoryDefault.properties));
      if (missingBefore.length) {
        defaultRulesApplied.push(`\u7c7b\u76ee\u5fc5\u586b\u5c5e\u6027\u7f3a\u5931\uff0c\u5df2\u5f3a\u5236\u8865\u9f50\uff1a${missingBefore.join(', ')}`);
      } else {
        defaultRulesApplied.push(`\u7c7b\u76ee\u5fc5\u586b\u5c5e\u6027\u5df2\u6309 Bumpers \u89c4\u5219\u590d\u6838\uff1aBrand Name / High-concerned chemical / Origin`);
      }
    }
    if (categoryDefault.status === 'unresolved') {
      defaultRulesApplied.push(
        `\u7c7b\u76ee\u672a\u547d\u4e2d\u5df2\u5b66\u4e60\u89c4\u5219\uff0c\u9700\u5148\u5b8c\u6210\u4e00\u6b21\u7c7b\u76ee\u5b66\u4e60\uff1b\u6700\u4f73\u5019\u9009=${categoryDefault.ruleId || 'none'}\uff0c\u7f6e\u4fe1\u5ea6=${categoryDefault.confidence}`
      );
    }
    if ((!Array.isArray(variationsParsed) || !variationsParsed.length) && asin && effectiveSupplyPrice) {
      payload.variationListStr = JSON.stringify([
        {
          id: null,
          skuId: null,
          skuCode: asin,
          gloGoodsValue: Number(effectiveSupplyPrice),
          gloLogisticValue: 0,
          supplyPrice: Number(effectiveSupplyPrice),
          specialProductTypeListJson: '',
          skuStockWareType: '',
          skuWarehouseStockListJson: '',
          sellableQuantity: Number(defaultStock || 15),
          effectiveSupplyPrice: null,
          packageWeight: defaultWeightKg,
          packageLength: defaultLength,
          packageWidth: defaultWidth,
          packageHeight: defaultHeight,
          packageWeightUnit: null,
          status: 'active',
          skuPropertyListJson: JSON.stringify([{ ...US_SHIPS_FROM_PROPERTY }]),
          imageList: null,
          destCountrySupplyPriceListJson: '',
        },
      ]);
      defaultRulesApplied.push(`variationListStr \u4e3a\u7a7a\uff0c\u5df2\u7528 ASIN + \u4f9b\u8d27\u4ef7 ${effectiveSupplyPrice} \u751f\u6210 1 \u6761 SKU`);
    } else if (Array.isArray(variationsParsed) && variationsParsed.length) {
      let changed = false;
      for (let index = 0; index < variationsParsed.length; index += 1) {
        const sku = variationsParsed[index];
        const perSkuDefaults = {
          ...skuDefaults,
          skuCode: skuDefaults.skuCode,
        };
        if (ensureSkuCommercialFields(sku, perSkuDefaults)) {
          changed = true;
          defaultRulesApplied.push(`SKU \u884c\u5b57\u6bb5\u4e3a\u7a7a\uff0c\u5df2\u8865\u8d27\u503c/\u7269\u6d41\u8d39/\u5e93\u5b58/SKU/\u91cd\u91cf/\u5c3a\u5bf8`);
        }
        if (!hasUsShipsFromOnSku(sku)) {
          ensureUsShipsFromOnSku(sku);
          changed = true;
          defaultRulesApplied.push('SKU \u53d8\u79cd\u53d1\u8d27\u5730\u4e3a\u7a7a\uff0c\u5df2\u8865 Ships From=United States');
        }
      }
      if (changed) payload.variationListStr = JSON.stringify(variationsParsed);
    }
    if (!payload.postageId && defaultPostageId) {
      payload.postageId = defaultPostageId;
      defaultRulesApplied.push(`\u7269\u6d41\u6a21\u677f\u4e3a\u7a7a\uff0c\u5df2\u6309\u9ed8\u8ba4 postageId=${defaultPostageId} \u8865\u9f50`);
    }
    Object.defineProperty(payload, '__diagnostics', {
      enumerable: false,
      value: {
        topLevelKeys: editData && editData.data ? Object.keys(editData.data) : Object.keys(editData || {}),
        productKeys: Object.keys(product).slice(0, 200),
        domFallback: Boolean(product.__domFallback),
        amazonSource: Boolean(product.__amazonSource),
        editDataKeys: product.__editDataKeys || null,
        foundPaths: Object.fromEntries(Object.entries(found).map(([key, item]) => [key, item.path || 'NOT_FOUND'])),
        derived: {
          sourceMode: product.__sourceMode || (product.__amazonSource ? 'amazon_crawlbox_empty_form' : 'edit_json'),
          detailWebFromDetailMobile: Boolean(detailWebDerived),
          asin,
          sourcePriceUsd: inferredSourcePrice,
          calculatedSupplyPriceCny: calculatedSupplyPrice,
          effectiveSupplyPriceCny: effectiveSupplyPrice,
          priceState,
          amazonBatchItem: amazonItem ? {
            asin: amazonItem.asin,
            price: amazonItem.price,
            categoryTerm: amazonItem.categoryTerm,
            dimensionsCm: amazonItem.dimensionsCm || null,
            weightKg: amazonItem.weightKg || null,
            detailEnrichedAt: amazonItem.detailEnrichedAt || '',
          } : null,
          valueSources,
          categoryResolver: categoryDefault,
          editPageRules: EDIT_PAGE_RULES,
          defaultRulesApplied,
        },
      },
    });

    return payload;
  }

  function validatePayload(payload) {
    const risks = [];
    const warnings = [];
    const diagnostics = payload.__diagnostics && payload.__diagnostics.derived ? payload.__diagnostics.derived : {};
    const amazonEmptyFormMode = diagnostics.sourceMode === 'amazon_crawlbox_empty_form';

    for (const field of REQUIRED_FIELDS) {
      if (field === 'id' && amazonEmptyFormMode && !payload[field]) {
        warnings.push('Amazon 空白表单模式：payload 没有旧店小秘产品 ID，将以 save.json op=1 返回的产品 ID 做落库校验');
        continue;
      }
      if (payload[field] === undefined || payload[field] === null || payload[field] === '') {
        risks.push(`\u7f3a\u5c11\u5fc5\u586b\u5b57\u6bb5\uff1a${field}`);
      }
    }

    const properties = parseMaybeJson(payload.productPropertyListJson, null);
    const images = parseMaybeJson(payload.mainImageListJson, null);
    const variations = parseMaybeJson(payload.variationListStr, null);
    const mobile = parseMaybeJson(payload.detailMobile, null);

    if (!Array.isArray(properties) || properties.length === 0) {
      risks.push('productPropertyListJson \u4e0d\u662f\u6709\u6548\u6570\u7ec4\u6216\u4e3a\u7a7a');
    }
    const requiredCategoryProperties = getCategoryPropertiesById(payload.categoryId);
    const missingCategoryProperties = findMissingRequiredPropertyNames(properties, requiredCategoryProperties);
    if (missingCategoryProperties.length) {
      risks.push(`\u7c7b\u76ee\u5fc5\u586b\u5c5e\u6027\u672a\u8865\u9f50\uff1a${missingCategoryProperties.join(', ')}`);
    }
    const categoryResolver = payload.__diagnostics && payload.__diagnostics.derived
      ? payload.__diagnostics.derived.categoryResolver
      : null;
    if (categoryResolver && categoryResolver.status === 'unresolved') {
      risks.push(`categoryResolver unresolved: learn category from a real edit-page save payload before continuing; best=${categoryResolver.ruleId || 'none'}`);
    }
    if (payload.categoryId && !/^\d+$/.test(String(payload.categoryId))) {
      risks.push(`categoryId is not a publish category id: ${payload.categoryId}`);
    }
    if (categoryResolver && categoryResolver.status === 'unresolved') {
      warnings.push(`\u7c7b\u76ee\u672a\u8fdb\u5165\u5df2\u5b66\u4e60\u89c4\u5219\u5e93\uff0c\u9700\u5148\u6293\u53d6\u4e00\u6b21\u771f\u5b9e\u7f16\u8f91\u9875\u4fdd\u5b58 payload \u5b66\u4e60\u7c7b\u76ee\uff1bbest=${categoryResolver.ruleId || 'none'}`);
    }
    if (!Array.isArray(images) || images.length === 0) {
      risks.push('mainImageListJson \u4e0d\u662f\u6709\u6548\u6570\u7ec4\u6216\u4e3a\u7a7a');
    }
    if (!Array.isArray(variations) || variations.length === 0) {
      risks.push('variationListStr \u4e0d\u662f\u6709\u6548\u6570\u7ec4\u6216\u4e3a\u7a7a');
    }
    if (!hasUsShipFromOptionValues(payload.optionValues, payload.optionValueIds)) {
      risks.push('\u53d8\u79cd\u53c2\u6570\u7f3a\u5c11\u5fc5\u586b\u53d1\u8d27\u5730\uff1aUnited States');
    }
    if (!mobile || typeof mobile !== 'object') {
      risks.push('detailMobile \u4e0d\u662f\u6709\u6548 JSON \u5bf9\u8c61');
    }
    const subjectText = String(payload.subject || '').trim();
    const detailPlain = plainTextFromHtml(payload.detailWeb) || extractTextFromDetailMobile(payload.detailMobile);
    const detailImageState = analyzePcDetailWebImages(payload.detailWeb, images || []);
    const marketingImages = [payload.marketImage1, payload.marketImage2].filter(Boolean);
    const complianceSource = getCurrentEditComplianceSource(subjectText);
    if (subjectText.length > EDIT_PAGE_RULES.titleMaxChars) {
      risks.push(`标题超过 ${EDIT_PAGE_RULES.titleMaxChars} 字符：当前 ${subjectText.length}`);
    }
    const subjectForbiddenTerms = findForbiddenTitleTerms(subjectText, complianceSource);
    if (subjectForbiddenTerms.length) {
      risks.push(`标题包含品牌词/商标/平台词，必须重新生成后再保存：${subjectForbiddenTerms.join(', ')}`);
    }
    const platformTextCheck = [
      ['标题', payload.subject],
      ['PC端描述', payload.detailWeb],
      ['移动端描述', payload.detailMobile],
      ['属性', payload.productPropertyListJson],
      ['规格/SKU', payload.variationListStr],
    ];
    for (const [label, value] of platformTextCheck) {
      const issues = findPlatformTextIssues(value);
      if (issues.length) {
        risks.push(`${label}包含平台不允许的引号或尺寸符号，必须先执行发布前字符清洗`);
      }
    }
    if (detailPlain.length < EDIT_PAGE_RULES.pcDescriptionMinChars) {
      risks.push(`PC端描述少于 ${EDIT_PAGE_RULES.pcDescriptionMinChars} 英文字符：当前 ${detailPlain.length}`);
    }
    if (detailImageState.currentProductImageCount < EDIT_PAGE_RULES.pcDescriptionMinImages) {
      risks.push(
        `PC端描述缺少当前商品图片：当前 ${detailImageState.currentProductImageCount}/${EDIT_PAGE_RULES.pcDescriptionMinImages}`
      );
    }
    if (detailImageState.leadingImageCount < EDIT_PAGE_RULES.pcDescriptionMinImages) {
      risks.push(
        `PC端描述排版错误：必须先图片后描述，开头图片 ${detailImageState.leadingImageCount}/${EDIT_PAGE_RULES.pcDescriptionMinImages}`
      );
    }
    if (hasForbiddenCommerceTerms(detailPlain)) {
      risks.push('PC端描述包含平台词或违规营销词，必须重新生成后再保存');
    }
    if (String(payload.postageId || '') !== EDIT_PAGE_RULES.postageTemplateId) {
      risks.push(`运费模板必须固定为 ${EDIT_PAGE_RULES.postageTemplateId}`);
    }
    if (marketingImages.length < EDIT_PAGE_RULES.marketingImageCount) {
      risks.push(`营销图片必须固定保留 ${EDIT_PAGE_RULES.marketingImageCount} 张`);
    } else if (new Set(marketingImages).size < EDIT_PAGE_RULES.marketingImageCount) {
      warnings.push('营销图片当前存在重复图；正式执行应优先使用系统一键生成的 2 张图');
    }
    warnings.push(`编辑页流程约束：${EDIT_PAGE_RULES.flow}；禁止 ${EDIT_PAGE_RULES.forbiddenEditPageAction}`);
    if (payload.__diagnostics && payload.__diagnostics.derived && payload.__diagnostics.derived.detailWebFromDetailMobile) {
      warnings.push('detailWeb \u4e3a\u7a7a\uff0c\u5df2\u5728 dry-run \u4e2d\u4ece detailMobile \u81ea\u52a8\u751f\u6210 PC \u63cf\u8ff0');
    }
    if (payload.__diagnostics && payload.__diagnostics.derived && payload.__diagnostics.derived.defaultRulesApplied) {
      for (const item of payload.__diagnostics.derived.defaultRulesApplied) {
        warnings.push(item);
      }
    }
    if (payload.__diagnostics && payload.__diagnostics.derived && payload.__diagnostics.derived.valueSources) {
      const sources = payload.__diagnostics.derived.valueSources;
      warnings.push(`货值算式：Amazon 页面展示价 USD × ${sources.taskFormula.exchangeRate} × ${sources.taskFormula.multiplier}`);
      const priceState = payload.__diagnostics.derived.priceState || {};
      if (!priceState.ok) {
        risks.push(`SKU 价格缺少可信来源：${priceState.reason || '必须使用当前商品可信 Amazon 页面展示价 USD 后按任务算式计算'}`);
      }
      if (sources.weight === 'default_missing_amazon_weight') warnings.push('\u91cd\u91cf\u4f7f\u7528\u9ed8\u8ba4 0.1kg\uff1aAmazon \u91cd\u91cf\u7f3a\u5931\u6216\u672a\u6293\u53d6');
      if (sources.dimensions === 'default_or_task_cm') warnings.push('\u5c3a\u5bf8\u4f7f\u7528\u4efb\u52a1/\u9ed8\u8ba4 cm\uff1aAmazon \u5c3a\u5bf8\u7f3a\u5931\u6216\u672a\u6293\u53d6');
    }

    if (Array.isArray(variations)) {
      const expectedSupplyPrice = diagnostics.priceState && diagnostics.priceState.ok
        ? diagnostics.priceState.supplyPrice
        : '';
      const expectedSkuAsin = getPrimaryAsinFromPayload(payload);
      const firstSku = variations[0] || {};
      if (!firstSku.skuCode) warnings.push('SKU \u4e3a\u7a7a\uff0c\u53ef\u80fd\u5f71\u54cd\u8ffd\u8e2a');
      if (firstSku.skuCode && !/^B0[A-Z0-9]{8}$/i.test(String(firstSku.skuCode))) {
        risks.push('SKU 编码必须等于当前 Amazon ASIN，不能使用变种文本或 ASIN 后缀');
      }
      if (expectedSkuAsin) {
        const mismatchedSkuCodes = variations.filter((sku) => {
          const skuCode = firstNonEmpty(sku.skuCode, sku.sku, sku.merchantSku, sku.sku_code);
          return normalizeCategoryText(skuCode) !== normalizeCategoryText(expectedSkuAsin);
        }).length;
        if (mismatchedSkuCodes) {
          risks.push(`SKU 编码必须固定为当前 ASIN ${expectedSkuAsin}：${mismatchedSkuCodes} 条 SKU 不一致`);
        }
      }
      if (!firstSku.supplyPrice && !firstSku.gloGoodsValue) risks.push('SKU \u4ef7\u683c\u4e3a\u7a7a');
      if (expectedSupplyPrice) {
        const mismatchedSkuPrices = variations.filter((sku) => {
          return !priceEqualsExpected(firstNonEmpty(sku.supplyPrice, sku.gloGoodsValue, sku.goodsValue), expectedSupplyPrice);
        }).length;
        if (mismatchedSkuPrices) {
          risks.push(`SKU 价格与任务公式不一致：${mismatchedSkuPrices} 条 SKU 未等于 ${expectedSupplyPrice}`);
        }
      }
      if (!firstSku.packageWeight) risks.push('SKU \u91cd\u91cf\u4e3a\u7a7a');
      if (!firstSku.packageLength || !firstSku.packageWidth || !firstSku.packageHeight) {
        risks.push('SKU \u5c3a\u5bf8\u4e0d\u5b8c\u6574');
      }
      if (!firstSku.sellableQuantity) warnings.push('\u5e93\u5b58\u4e3a\u7a7a\u6216\u4e3a 0');
      const incompleteSkuRows = variations.filter((sku) => {
        return (
          (!sku.skuCode && !sku.sku && !sku.merchantSku) ||
          (!sku.gloGoodsValue && !sku.supplyPrice && !sku.goodsValue) ||
          isBlank(sku.gloLogisticValue) ||
          (!sku.sellableQuantity && !sku.inventory && !sku.stock) ||
          (!sku.packageWeight && !sku.weight) ||
          (!sku.packageLength && !sku.length) ||
          (!sku.packageWidth && !sku.width) ||
          (!sku.packageHeight && !sku.height)
        );
      }).length;
      if (incompleteSkuRows) {
        risks.push(`\u6709 ${incompleteSkuRows} \u6761 SKU \u53d8\u79cd\u4fe1\u606f\u4e0d\u5b8c\u6574`);
      }
      const missingShipsFromCount = variations.filter((sku) => !hasUsShipsFromOnSku(sku)).length;
      if (missingShipsFromCount) {
        risks.push(`\u6709 ${missingShipsFromCount} \u6761 SKU \u7f3a\u5c11 Ships From=United States`);
      }
      const missingSkuEnumRows = variations.filter((sku) => {
        const skuProperties = parseMaybeJson(sku && sku.skuPropertyListJson, []);
        if (!Array.isArray(skuProperties)) return false;
        return skuProperties.some((property) => {
          if (!property || String(property.sku_property_id) === US_SHIPS_FROM_PROPERTY.sku_property_id) return false;
          return property.sku_property_id && !property.property_value_id;
        });
      }).length;
      if (missingSkuEnumRows) {
        risks.push(`\u6709 ${missingSkuEnumRows} \u6761 SKU \u53d8\u79cd\u5c5e\u6027\u7f3a\u5c11 property_value_id`);
      }
    }

    const propertyText = JSON.stringify(properties || '').toLowerCase();
    if (!propertyText.includes('brand')) warnings.push('\u5c5e\u6027\u91cc\u672a\u68c0\u6d4b\u5230 Brand Name \u5b57\u6bb5');
    if (propertyText.includes('nike') || propertyText.includes('adidas') || propertyText.includes('disney')) {
      risks.push('\u5c5e\u6027\u91cc\u7591\u4f3c\u5305\u542b\u54c1\u724c\u8bcd\uff0c\u9700\u8981\u4eba\u5de5\u786e\u8ba4');
    }

    return {
      app: APP_NAME,
      version: VERSION,
      createdAt: nowIso(),
      pass: risks.length === 0,
      productId: payload.id,
      subject: payload.subject,
      fieldCount: Object.keys(payload).length,
      missingSaveFields: SAVE_FIELDS.filter((field) => !(field in payload)),
      risks,
      warnings,
      diagnostics: payload.__diagnostics || null,
      categoryState: {
        categoryId: payload.categoryId,
        resolver: payload.__diagnostics && payload.__diagnostics.derived ? payload.__diagnostics.derived.categoryResolver : null,
        productPropertySource: payload.__diagnostics && payload.__diagnostics.foundPaths ? payload.__diagnostics.foundPaths.properties : '',
        optionValuesSource: payload.__diagnostics && payload.__diagnostics.foundPaths ? payload.__diagnostics.foundPaths.optionValues : '',
        optionValueIdsSource: payload.__diagnostics && payload.__diagnostics.foundPaths ? payload.__diagnostics.foundPaths.optionValueIds : '',
        shipFromSource: payload.__diagnostics && payload.__diagnostics.foundPaths ? payload.__diagnostics.foundPaths.shipFrom : '',
        variationSource: payload.__diagnostics && payload.__diagnostics.foundPaths ? payload.__diagnostics.foundPaths.variations : '',
        defaultRulesApplied:
          payload.__diagnostics && payload.__diagnostics.derived && payload.__diagnostics.derived.defaultRulesApplied
            ? payload.__diagnostics.derived.defaultRulesApplied
            : [],
      },
      payloadPreview: {
        id: payload.id,
        shopId: payload.shopId,
        categoryId: payload.categoryId,
        subject: payload.subject,
        postageId: payload.postageId,
        imageCount: Array.isArray(images) ? images.length : 0,
        skuCount: Array.isArray(variations) ? variations.length : 0,
      },
    };
  }

  async function apiFetchJson(url, options = {}) {
    const startedAt = performance.now();
    const method = String(options.method || 'GET').toUpperCase();
    const response = await fetch(url, {
      credentials: 'include',
      ...options,
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        ...(options.headers || {}),
      },
    });
    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (_) {
      rememberApiRecord({
        url,
        method,
        status: response.status,
        ok: response.ok,
        durationMs: Math.round(performance.now() - startedAt),
        responseText: text.slice(0, 2000),
        parseError: true,
      });
      throw new Error(`\u63a5\u53e3\u8fd4\u56de\u4e0d\u662f JSON\uff1a${text.slice(0, 200)}`);
    }
    rememberApiRecord({
      url,
      method,
      status: response.status,
      ok: response.ok,
      durationMs: Math.round(performance.now() - startedAt),
      response: json,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
    return json;
  }

  function findListInResponse(json) {
    const candidates = [
      json && json.data && json.data.page && json.data.page.list,
      json && json.data && json.data.list,
      json && json.data && json.data.rows,
      json && json.data && json.data.result,
      json && json.page && json.page.list,
      json && json.list,
      json && json.rows,
    ];
    return candidates.find((value) => Array.isArray(value)) || [];
  }

  function guessStateCandidatesFromPage() {
    const candidates = [
      { dxmState: 'draft', productState: '' },
      { dxmState: 'draft', productState: '0' },
    ];
    const seen = new Set();
    return candidates.filter((item) => {
      const key = `${item.dxmState}|${item.dxmOfflineState || ''}|${item.productState || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async function loadFirstDraftProduct() {
    const stateCandidates = guessStateCandidatesFromPage();
    const bodies = [];
    for (const item of stateCandidates) {
      bodies.push(new URLSearchParams({
        pageNo: '1',
        pageSize: '1',
        total: '0',
        shopId: '-1',
        searchType: '0',
        searchValue: '',
        sortName: '1',
        sortValue: '2',
        dxmState: item.dxmState,
        dxmOfflineState: item.dxmOfflineState || '',
        productSearchType: '1',
        fullCid: '',
        productState: item.productState,
      }));
      bodies.push(new URLSearchParams({
        pageNo: '1',
        pageSize: '1',
        dxmState: item.dxmState,
        dxmOfflineState: item.dxmOfflineState || '',
        productState: item.productState,
      }));
    }

    let lastError = null;
    for (const body of bodies) {
      try {
        const json = await apiFetchJson('/api/smtlocalProduct/pageList.json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body,
        });
        const list = findListInResponse(json);
        if (list.length && list[0].id) {
          state.productId = String(list[0].id);
          const manualId = $(`#${PANEL_ID} [data-field="manualProductId"]`);
          if (manualId) manualId.value = state.productId;
          log(`\u5df2\u901a\u8fc7 pageList \u63a5\u53e3\u8bfb\u53d6\u5f53\u524d\u5217\u8868\u7b2c 1 \u6761\u4ea7\u54c1\uff1a${state.productId}`);
          updateUi();
          return state.productId;
        }
        lastError = new Error('pageList \u8fd4\u56de\u4e3a\u7a7a');
      } catch (error) {
        lastError = error;
      }
    }

    const domProductId = extractProductIdFromCurrentList();
    if (domProductId) {
      state.productId = domProductId;
      const manualId = $(`#${PANEL_ID} [data-field="manualProductId"]`);
      if (manualId) manualId.value = domProductId;
      log(`pageList \u672a\u53d6\u5230\uff0c\u5df2\u4ece\u5f53\u524d\u9875\u9762 DOM \u515c\u5e95\u8bfb\u53d6\u4ea7\u54c1 ID\uff1a${state.productId}`);
      updateUi();
      return state.productId;
    }

    throw lastError || new Error('\u672a\u80fd\u8bfb\u53d6\u5f53\u524d\u4ea7\u54c1\u5217\u8868');
  }

  async function loadEditJson() {
    const manualId = $(`#${PANEL_ID} [data-field="manualProductId"]`);
    const productId =
      (manualId && manualId.value.trim()) ||
      state.productId ||
      extractProductIdFromCurrentList() ||
      extractProductIdFromCurrentPage();
    if (!productId) throw new Error('\u8fd8\u6ca1\u6709\u4ea7\u54c1 ID\uff0c\u8bf7\u5148\u8bfb\u53d6\u5f53\u524d\u7b2c 1 \u6761\uff0c\u6216\u8fdb\u5165\u4ea7\u54c1\u7f16\u8f91\u9875\uff0c\u6216\u624b\u52a8\u586b\u5199\u4ea7\u54c1 ID');
    state.productId = productId;
    if (manualId && !manualId.value.trim()) manualId.value = productId;
    const json = await apiFetchJson(`/api/smtlocalProduct/edit.json?id=${encodeURIComponent(productId)}`);
    state.editData = json;
    state.inputEditData = json;
    state.afterOp1EditData = null;
    log(`\u5df2\u8bfb\u53d6 edit.json\uff1a${productId}`);
    updateUi();
    return json;
  }

  async function ensureEditDataForDryRun() {
    if (state.editData) return state.editData;
    const manualId = $(`#${PANEL_ID} [data-field="manualProductId"]`);
    const productId =
      (manualId && manualId.value.trim()) ||
      state.productId ||
      extractProductIdFromCurrentList() ||
      extractProductIdFromCurrentPage();
    if (productId) return loadEditJson();

    const json = buildAmazonEditDataContext();
    state.editData = json;
    state.inputEditData = json;
    state.afterOp1EditData = null;
    state.productId = '';
    log('鏈娴嬪埌搴楀皬绉樹骇鍝?ID锛屽凡鍒囨崲涓?Amazon 閲囬泦鏁版嵁 -> 绌虹櫧琛ㄥ崟 payload 妯″紡');
    updateUi();
    return json;
  }

  function makeCrc32Table() {
    const table = [];
    for (let i = 0; i < 256; i += 1) {
      let c = i;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c >>> 0;
    }
    return table;
  }

  const CRC_TABLE = makeCrc32Table();

  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function dosDateTime(date) {
    const year = Math.max(date.getFullYear(), 1980);
    const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
    const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
    return { time, day };
  }

  function writeU16(view, offset, value) {
    view.setUint16(offset, value, true);
  }

  function writeU32(view, offset, value) {
    view.setUint32(offset, value >>> 0, true);
  }

  function concatBytes(parts) {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
      out.set(part, offset);
      offset += part.length;
    }
    return out;
  }

  function makeStoredZip(fileName, text) {
    return makeStoredZipFiles([{ fileName, text }]);
  }

  function makeStoredZipFiles(files) {
    const encoder = new TextEncoder();
    const stamp = dosDateTime(new Date());
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    for (const file of files) {
      const nameBytes = encoder.encode(file.fileName);
      const dataBytes = file.bytes || encoder.encode(file.text == null ? '' : String(file.text));
      const checksum = crc32(dataBytes);

      const localHeader = new Uint8Array(30 + nameBytes.length);
      const localView = new DataView(localHeader.buffer);
      writeU32(localView, 0, 0x04034b50);
      writeU16(localView, 4, 20);
      writeU16(localView, 6, 0x0800);
      writeU16(localView, 8, 0);
      writeU16(localView, 10, stamp.time);
      writeU16(localView, 12, stamp.day);
      writeU32(localView, 14, checksum);
      writeU32(localView, 18, dataBytes.length);
      writeU32(localView, 22, dataBytes.length);
      writeU16(localView, 26, nameBytes.length);
      writeU16(localView, 28, 0);
      localHeader.set(nameBytes, 30);

      const centralHeader = new Uint8Array(46 + nameBytes.length);
      const centralView = new DataView(centralHeader.buffer);
      writeU32(centralView, 0, 0x02014b50);
      writeU16(centralView, 4, 20);
      writeU16(centralView, 6, 20);
      writeU16(centralView, 8, 0x0800);
      writeU16(centralView, 10, 0);
      writeU16(centralView, 12, stamp.time);
      writeU16(centralView, 14, stamp.day);
      writeU32(centralView, 16, checksum);
      writeU32(centralView, 20, dataBytes.length);
      writeU32(centralView, 24, dataBytes.length);
      writeU16(centralView, 28, nameBytes.length);
      writeU16(centralView, 30, 0);
      writeU16(centralView, 32, 0);
      writeU16(centralView, 34, 0);
      writeU16(centralView, 36, 0);
      writeU32(centralView, 38, 0);
      writeU32(centralView, 42, offset);
      centralHeader.set(nameBytes, 46);

      localParts.push(localHeader, dataBytes);
      centralParts.push(centralHeader);
      offset += localHeader.length + dataBytes.length;
    }

    const centralOffset = offset;
    const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    writeU32(endView, 0, 0x06054b50);
    writeU16(endView, 4, 0);
    writeU16(endView, 6, 0);
    writeU16(endView, 8, files.length);
    writeU16(endView, 10, files.length);
    writeU32(endView, 12, centralSize);
    writeU32(endView, 16, centralOffset);
    writeU16(endView, 20, 0);

    return new Blob([concatBytes([...localParts, ...centralParts, end])], {
      type: 'application/zip',
    });
  }

  async function runDryRun() {
    await ensureEditDataForDryRun();
    assertDraftProductForMainFlow(state.editData);
    const payload = buildPayloadFromEdit(state.editData);
    await resolveCategoryWithDxmApi(payload, state.editData);
    const report = validatePayload(payload);
    const text = JSON.stringify(payload);
    const zipBlob = makeStoredZip('choiceSave.txt', text);

    state.payload = payload;
    state.zipBlob = zipBlob;
    state.report = {
      ...report,
      apiRecords: state.apiRecords.slice(),
      zip: {
        fileName: 'choiceSave.zip',
        entryName: 'choiceSave.txt',
        contentBytes: new TextEncoder().encode(text).length,
        zipBytes: zipBlob.size,
        formData: { file: 'Blob(application/zip)', op: '2' },
      },
    };

    if (report.pass) {
      log('dry-run \u901a\u8fc7\uff1a\u53ef\u4ee5\u4e0b\u8f7d run \u62a5\u544a\u5305\u68c0\u67e5\uff1b\u786e\u8ba4\u540e\u624d\u8fdb\u5165 op=1 \u4fdd\u5b58\u9a8c\u8bc1\u3002', state.report);
    } else {
      const riskSummary = report.risks && report.risks.length ? report.risks.slice(0, 5).join(' | ') : '\u672a\u77e5\u98ce\u9669';
      log(`dry-run \u672a\u901a\u8fc7\uff1a\u4e0d\u8981\u70b9 op=1 / \u4e0d\u8981\u771f\u5b9e\u63d0\u4ea4\u3002\u4e0b\u4e00\u6b65\u8bf7\u70b9\u51fb\u201c\u4e0b\u8f7drun\u62a5\u544a\u5305\u201d\u53d1\u7ed9 Codex\u3002\u98ce\u9669\uff1a${riskSummary}`, state.report);
    }
    updateUi();
  }

  function getCapturedSavePayloadRecords() {
    const sources = [
      window.__DXM_SAVE_PAYLOAD_CAPTURE_V3_RECORDS__,
      window.unsafeWindow && window.unsafeWindow.__DXM_SAVE_PAYLOAD_CAPTURE_V3_RECORDS__,
    ].filter(Boolean);
    const records = [];
    for (const source of sources) {
      if (Array.isArray(source.records)) records.push(...source.records);
    }
    return records
      .filter((record) => record && record.request && record.request.body && record.request.body.choiceSaveJson)
      .filter((record) => /save_payload|save\.json/i.test(`${record.request.type || ''} ${record.request.url || ''}`))
      .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  }

  function getLatestCapturedSavePayload() {
    const records = getCapturedSavePayloadRecords();
    return records[records.length - 1] || null;
  }

  function valueKind(value) {
    if (value == null) return 'blank';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  function normalizedPayloadValue(value) {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (!/^[\[{]/.test(trimmed)) return trimmed;
    return parseMaybeJson(trimmed, trimmed);
  }

  function payloadValueSummary(value) {
    const normalized = normalizedPayloadValue(value);
    if (Array.isArray(normalized)) return { kind: 'array', count: normalized.length, sampleKeys: normalized[0] && typeof normalized[0] === 'object' ? Object.keys(normalized[0]).slice(0, 30) : [] };
    if (normalized && typeof normalized === 'object') return { kind: 'object', keys: Object.keys(normalized).slice(0, 50) };
    return { kind: valueKind(normalized), value: String(normalized == null ? '' : normalized).slice(0, 240) };
  }

  function comparePayloadValues(generatedValue, capturedValue) {
    const generated = normalizedPayloadValue(generatedValue);
    const captured = normalizedPayloadValue(capturedValue);
    const generatedJson = JSON.stringify(generated);
    const capturedJson = JSON.stringify(captured);
    if (generatedJson === capturedJson) return null;
    return {
      generated: payloadValueSummary(generatedValue),
      captured: payloadValueSummary(capturedValue),
    };
  }

  function summarizePayloadCore(payload) {
    const variations = parseMaybeJson(payload && payload.variationListStr, []);
    const properties = parseMaybeJson(payload && payload.productPropertyListJson, []);
    return {
      id: payload && payload.id,
      op: payload && payload.op,
      categoryId: payload && payload.categoryId,
      postageId: payload && payload.postageId,
      shipFrom: payload && payload.shipFrom,
      propertyCount: Array.isArray(properties) ? properties.length : 0,
      variationSummary: summarizeVariationRows(payload && payload.variationListStr),
      optionValues: payloadValueSummary(payload && payload.optionValues),
      optionValueIds: payloadValueSummary(payload && payload.optionValueIds),
      fieldCount: payload && typeof payload === 'object' ? Object.keys(payload).length : 0,
      variationKeys: Array.isArray(variations) && variations[0] ? Object.keys(variations[0]).slice(0, 80) : [],
    };
  }

  function compareGeneratedWithCapturedSavePayload(generatedPayload, capturedPayload) {
    const generatedKeys = Object.keys(generatedPayload || {});
    const capturedKeys = Object.keys(capturedPayload || {});
    const allKeys = Array.from(new Set([...generatedKeys, ...capturedKeys])).sort();
    const missingInGenerated = capturedKeys.filter((key) => !(key in (generatedPayload || {}))).sort();
    const missingInCaptured = generatedKeys.filter((key) => !(key in (capturedPayload || {}))).sort();
    const changed = {};
    const importantFields = new Set([
      'id',
      'shopId',
      'categoryId',
      'productPropertyListJson',
      'variationListStr',
      'optionValues',
      'optionValueIds',
      'shipFrom',
      'postageId',
      'deliveryTime',
      'detailMobile',
      'detailWeb',
      'op',
    ]);
    for (const key of allKeys) {
      if (!(key in (generatedPayload || {})) || !(key in (capturedPayload || {}))) continue;
      const diff = comparePayloadValues(generatedPayload[key], capturedPayload[key]);
      if (diff && importantFields.has(key)) changed[key] = diff;
    }
    return {
      comparedAt: nowIso(),
      passShape: missingInGenerated.length === 0,
      missingInGenerated,
      missingInCaptured,
      importantDiffs: changed,
      generatedCore: summarizePayloadCore(generatedPayload || {}),
      capturedCore: summarizePayloadCore(capturedPayload || {}),
      nextAction: missingInGenerated.length
        ? 'map_missing_captured_fields_into_generated_payload'
        : Object.keys(changed).length
        ? 'verify_important_field_differences_before_save'
        : 'ready_to_build_edit_page_save_payload_dry_run',
    };
  }

  async function learnLatestCapturedSavePayload() {
    if (!state.payload) await runDryRun();
    const record = getLatestCapturedSavePayload();
    if (!record) {
      throw new Error('没有读取到 V3 抓包记录。请保持 V3 抓包插件启用，并触发一次保存以抓取真实 save.json payload。');
    }
    const capturedPayload = record.request.body.choiceSaveJson;
    const comparison = compareGeneratedWithCapturedSavePayload(state.payload, capturedPayload);
    state.savePayloadLearning = {
      recordId: record.id,
      capturedAt: record.createdAt,
      page: record.page,
      lastAction: record.lastAction,
      request: {
        url: record.request.url,
        method: record.request.method,
        op: record.request.body.op,
        zipEntries: record.request.body.zipEntries,
        responseStatus: record.response && record.response.status,
      },
      comparison,
    };
    if (state.report) state.report.savePayloadLearning = state.savePayloadLearning;
    log(
      comparison.passShape
        ? `已学习真实保存 payload：字段结构可对齐，关键差异 ${Object.keys(comparison.importantDiffs).length} 项`
        : `已学习真实保存 payload：生成 payload 缺 ${comparison.missingInGenerated.length} 个字段`,
      state.savePayloadLearning
    );
    updateUi();
    return state.savePayloadLearning;
  }

  function makeZipForPayload(payload, op) {
    const payloadForOp = {
      ...payload,
      op,
    };
    const text = JSON.stringify(payloadForOp);
    return {
      payload: payloadForOp,
      text,
      zipBlob: makeStoredZip('choiceSave.txt', text),
      contentBytes: new TextEncoder().encode(text).length,
    };
  }

  async function callSaveJson(op) {
    if (!state.report || !state.report.pass || !state.payload) {
      throw new Error('dry-run \u672a\u901a\u8fc7\uff0c\u7981\u6b62\u8c03\u7528 save.json');
    }
    if (Number(op) !== 1) {
      throw new Error('本阶段禁止调用 op=2；当前只允许 save.json op=1 落库验证');
    }
    const built = makeZipForPayload(state.payload, op);
    const form = new FormData();
    form.append('file', built.zipBlob, 'blob');
    form.append('op', String(op));
    const json = await apiFetchJson('/api/smtlocalProduct/save.json', {
      method: 'POST',
      body: form,
    });
    const returnedProductId = extractProductIdFromText(JSON.stringify(json && json.data !== undefined ? json.data : json || ''));
    if ((!state.payload.id || !/^\d{10,}$/.test(String(state.payload.id))) && returnedProductId) {
      state.payload.id = returnedProductId;
      state.productId = returnedProductId;
    }
    return {
      op,
      response: json,
      payloadPreview: {
        id: state.payload.id || built.payload.id,
        returnedProductId,
        categoryId: built.payload.categoryId,
        postageId: built.payload.postageId,
        skuCount: Array.isArray(parseMaybeJson(built.payload.variationListStr, []))
          ? parseMaybeJson(built.payload.variationListStr, []).length
          : 0,
      },
      zip: {
        entryName: 'choiceSave.txt',
        contentBytes: built.contentBytes,
        zipBytes: built.zipBlob.size,
      },
      at: nowIso(),
    };
  }

  function summarizeVariationRows(rawVariationList) {
    const rows = parseMaybeJson(rawVariationList, []);
    if (!Array.isArray(rows)) return { rowCount: 0, completeRows: 0, rows: [] };
    const summaries = rows.map((sku) => ({
      skuCode: firstNonEmpty(sku.skuCode, sku.sku, sku.merchantSku, sku.sku_code),
      goodsValue: firstNonEmpty(sku.gloGoodsValue, sku.goodsValue, sku.skuGoodsValue, sku.skuValue, sku.supplyPrice, sku.countrySupplyPrice),
      logisticValue: firstNonEmpty(sku.gloLogisticValue, sku.logisticValue, sku.freight, sku.freightPrice, sku.skuFreight),
      stock: firstNonEmpty(sku.sellableQuantity, sku.inventory, sku.skuStock, sku.stock, sku.skuStockNum),
      weight: firstNonEmpty(sku.packageWeight, sku.weight, sku.skuWeight),
      length: firstNonEmpty(sku.packageLength, sku.length, sku.skuLength),
      width: firstNonEmpty(sku.packageWidth, sku.width, sku.skuWidth),
      height: firstNonEmpty(sku.packageHeight, sku.height, sku.skuHeight),
      hasUsShipsFrom: hasUsShipsFromOnSku(sku),
    }));
    const completeRows = summaries.filter((sku) => {
      return (
        !isBlank(sku.skuCode) &&
        !isBlank(sku.goodsValue) &&
        !isBlank(sku.logisticValue) &&
        !isBlank(sku.stock) &&
        !isBlank(sku.weight) &&
        !isBlank(sku.length) &&
        !isBlank(sku.width) &&
        !isBlank(sku.height) &&
        sku.hasUsShipsFrom
      );
    }).length;
    return { rowCount: rows.length, completeRows, rows: summaries };
  }

  async function verifyOp1Persistence() {
    if (!state.payload || !state.payload.id) return null;
    const before = summarizeVariationRows(state.payload.variationListStr);
    const json = await apiFetchJson(`/api/smtlocalProduct/edit.json?id=${encodeURIComponent(state.payload.id)}`);
    const product = getProductFromEdit(json) || {};
    const afterSource = product.variationListStr || product.variationList;
    const after = summarizeVariationRows(afterSource);
    const alreadyWaitPublish = product.dxmState === 'offline' && product.dxmOfflineState === 'waitPublish';
    const result = {
      checkedAt: nowIso(),
      productId: state.payload.id,
      dxmState: product.dxmState,
      dxmOfflineState: product.dxmOfflineState,
      alreadyWaitPublish,
      afterSourceField: product.variationListStr ? 'variationListStr' : product.variationList ? 'variationList' : 'NONE',
      note: alreadyWaitPublish
        ? '\u5f53\u524d\u4ea7\u54c1\u5df2\u5728\u5f85\u53d1\u5e03\u72b6\u6001\uff0c\u91c7\u96c6\u7bb1 op=1 \u4e0d\u80fd\u518d\u6b21\u79fb\u5165\u5f85\u53d1\u5e03\uff1b\u9700\u8981\u6293\u9875\u9762\u4fdd\u5b58 save.json payload \u5b66\u4e60\u5f85\u53d1\u5e03\u4fdd\u5b58\u7ed3\u6784\u3002'
        : '',
      beforePayload: before,
      afterEditJson: after,
      persisted:
        !alreadyWaitPublish &&
        before.rowCount > 0 &&
        after.rowCount === before.rowCount &&
        after.completeRows === before.completeRows &&
        after.completeRows === after.rowCount,
      productKeys: Object.keys(product).slice(0, 160),
    };
    state.editData = json;
    state.afterOp1EditData = json;
    return result;
  }

  async function saveCompletionOnly() {
    const result = await callSaveJson(1);
    state.report.completionSaveResult = result;
    state.report.apiRecords = state.apiRecords.slice();
    log(`save.json op=1 宸茶皟鐢細${JSON.stringify(result.response).slice(0, 300)}`, result);
    if (!isSaveResponseSuccess(result.response)) {
      state.report.persistenceCheck = {
        checkedAt: nowIso(),
        productId: state.payload && state.payload.id,
        persisted: false,
        skipped: true,
        reason: 'op=1 save.json 返回失败，禁止用 edit.json 旧数据误判为落库成功',
        response: result.response,
      };
      log('op=1 返回失败，已停止落库校验；禁止继续 op=2', state.report.persistenceCheck);
      updateUi();
      return;
    }
    try {
      const persistence = await verifyOp1Persistence();
      state.report.persistenceCheck = persistence;
      if (persistence && persistence.persisted) {
        log(`op=1 \u843d\u5e93\u6821\u9a8c\u901a\u8fc7\uff1a${persistence.afterEditJson.completeRows}/${persistence.afterEditJson.rowCount} \u6761\u53d8\u79cd\u5b8c\u6574`);
      } else if (persistence && persistence.alreadyWaitPublish) {
        log('\u5f53\u524d\u4ea7\u54c1\u5df2\u5728\u5f85\u53d1\u5e03\uff0c\u4e0d\u80fd\u7528\u91c7\u96c6\u7bb1 op=1 \u590d\u5199\u53d8\u79cd\uff1b\u8bf7\u7528 V3 \u6293\u9875\u9762\u4fdd\u5b58 payload', persistence);
      } else if (persistence) {
        log(`op=1 \u843d\u5e93\u6821\u9a8c\u672a\u901a\u8fc7\uff1a${persistence.afterEditJson.completeRows}/${persistence.afterEditJson.rowCount} \u6761\u53d8\u79cd\u5b8c\u6574`, persistence);
      }
    } catch (error) {
      log(`op=1 \u843d\u5e93\u6821\u9a8c\u5931\u8d25\uff1a${error.message}`);
    }
    updateUi();
  }

  function dispatchInputEvents(input) {
    if (typeof input.focus === 'function') input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));
    input.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: String(input.value || '') }));
    input.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: String(input.value || '') }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', bubbles: true, cancelable: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function setInputValue(input, value) {
    if (!input || value === null || value === undefined) return false;
    const prototype = input instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    if (descriptor && descriptor.set) descriptor.set.call(input, String(value));
    else input.value = String(value);
    dispatchInputEvents(input);
    return true;
  }

  function setSelectSearchInputValue(input, value) {
    if (!input || value === null || value === undefined) return false;
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    if (descriptor && descriptor.set) descriptor.set.call(input, String(value));
    else input.value = String(value);
    if (typeof input.focus === 'function') input.focus();
    input.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: String(value) }));
    return true;
  }

  function dispatchKeyboardEvent(element, type, key) {
    if (!element) return;
    const keyMap = {
      Enter: { code: 'Enter', keyCode: 13, which: 13 },
      ArrowDown: { code: 'ArrowDown', keyCode: 40, which: 40 },
      ArrowUp: { code: 'ArrowUp', keyCode: 38, which: 38 },
      Escape: { code: 'Escape', keyCode: 27, which: 27 },
      Tab: { code: 'Tab', keyCode: 9, which: 9 },
    };
    const meta = keyMap[key] || { code: key, keyCode: 0, which: 0 };
    element.dispatchEvent(new KeyboardEvent(type, {
      key,
      code: meta.code,
      keyCode: meta.keyCode,
      which: meta.which,
      bubbles: true,
      cancelable: true,
      composed: true,
    }));
  }

  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function isEditPage() {
    return /\/web\/smtlocalProduct\/edit/i.test(location.pathname);
  }

  async function withExclusiveEditExecution(task) {
    const originals = {
      scrollIntoView: window.Element && window.Element.prototype ? window.Element.prototype.scrollIntoView : null,
      scrollTo: window.scrollTo,
      scrollBy: window.scrollBy,
    };
    const scrollBlocker = function blockedEditScroll() {
      editFieldLocks.scrollBlocked += 1;
    };
    editFieldLocks.active = true;
    editFieldLocks.scrollBlocked = 0;
    editFieldLocks.lockViolations = [];
    try {
      if (window.Element && window.Element.prototype && originals.scrollIntoView) {
        window.Element.prototype.scrollIntoView = scrollBlocker;
      }
      window.scrollTo = scrollBlocker;
      window.scrollBy = scrollBlocker;
      return await task();
    } finally {
      if (window.Element && window.Element.prototype && originals.scrollIntoView) {
        window.Element.prototype.scrollIntoView = originals.scrollIntoView;
      }
      window.scrollTo = originals.scrollTo;
      window.scrollBy = originals.scrollBy;
      editFieldLocks.active = false;
    }
  }

  function setEditableHtml(element, html) {
    if (!element || isBlank(html)) return false;
    element.innerHTML = String(html);
    dispatchInputEvents(element);
    return true;
  }

  function getCurrentEditComplianceSource(titleText) {
    const product = getProductFromEdit(state.editData) || {};
    const sourceUrl = firstNonEmpty(product.sourceUrl, extractSourceUrlFromCurrentEditPage());
    const asin = extractAsin(`${sourceUrl} ${product.sourceId || ''} ${product.platformProductId || ''} ${titleText || ''}`);
    const item = getAmazonBatchItem(product) || {};
    return {
      ...item,
      ...product,
      asin: firstNonEmpty(item.asin, asin),
      sourceUrl,
      title: firstNonEmpty(titleText, item.title, product.subject),
      subject: firstNonEmpty(titleText, product.subject, item.title),
      detailTextSample: firstNonEmpty(item.detailTextSample, product.detailText, product.detailWeb, plainTextFromHtml(product.detailWeb || '')),
    };
  }

  function isLikelyTitleInput(input) {
    if (!input || input.closest(`#${PANEL_ID}`) || !visibleElement(input)) return false;
    const text = getInputText(input);
    const name = `${input.name || ''} ${input.id || ''} ${input.getAttribute('placeholder') || ''}`.toLowerCase();
    if (text.length < 20 || text.length > 260) return false;
    if (/^https?:\/\//i.test(text) || /amazon\.com|\/dp\/B0/i.test(text)) return false;
    if (/^\d+(\.\d+)?$/.test(text) || /^[A-Z0-9]{8,16}(?:-\d+)?$/i.test(text)) return false;
    if (/sku|price|weight|length|width|height|source|url|asin|brand|attr|stock|postage|freight|template/i.test(name)) return false;
    return /[a-z]/i.test(text);
  }

  function findProductTitleInput() {
    const candidates = Array.from(document.querySelectorAll('input[type="text"], textarea'))
      .filter(isLikelyTitleInput)
      .map((input) => ({ input, text: getInputText(input), rect: input.getBoundingClientRect() }));
    if (!candidates.length) return null;
    candidates.sort((a, b) => {
      const aScore = (a.text.length > 80 ? 20 : 0) + (a.rect.top < 900 ? 10 : 0);
      const bScore = (b.text.length > 80 ? 20 : 0) + (b.rect.top < 900 ? 10 : 0);
      return bScore - aScore || a.rect.top - b.rect.top;
    });
    return candidates[0].input;
  }

  function applyVisibleTitleRule() {
    const input = findProductTitleInput();
    if (!input) return { changed: false, reason: 'title input not found' };
    const original = getInputText(input);
    const source = getCurrentEditComplianceSource(original);
    let title = buildCompliantProductTitle(original, source);
    let attempts = 1;
    while (findForbiddenTitleTerms(title, source).length && attempts < 4) {
      title = buildCompliantProductTitle(title, source);
      attempts += 1;
    }
    const changed = setInputValue(input, title);
    return { changed, original, value: title, length: title.length, attempts, forbiddenTerms: findForbiddenTitleTerms(title, source) };
  }

  function findVisiblePcDescriptionTarget() {
    const contentEditable = Array.from(document.querySelectorAll('[contenteditable="true"]'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node))
      .map((node) => {
        const rect = node.getBoundingClientRect();
        return { node, area: rect.width * rect.height, text: getInputText(node) };
      })
      .filter((item) => item.area > 10000 || item.text.length > 100)
      .sort((a, b) => b.area - a.area);
    if (contentEditable.length) return { type: 'contenteditable', node: contentEditable[0].node };

    const iframes = Array.from(document.querySelectorAll('iframe')).filter(visibleElement);
    for (const iframe of iframes) {
      try {
        const body = iframe.contentDocument && iframe.contentDocument.body;
        if (body) return { type: 'iframe', node: body };
      } catch (_) {
        // Cross-origin editors cannot be edited directly.
      }
    }

    const textarea = Array.from(document.querySelectorAll('textarea'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node))
      .sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0];
    if (textarea) return { type: 'textarea', node: textarea };
    return null;
  }

  function syncHiddenDetailFields(html) {
    let count = 0;
    const selector = [
      'textarea[name*="detail" i]',
      'textarea[id*="detail" i]',
      'input[name*="detail" i]',
      'input[id*="detail" i]',
      'textarea[id^="ckeditor"]',
      'textarea[name^="ckeditor"]',
    ].join(',');
    Array.from(document.querySelectorAll(selector)).forEach((node) => {
      if (node.closest(`#${PANEL_ID}`)) return;
      if (setInputValue(node, html)) count += 1;
    });
    return count;
  }

  function syncCkeditorDescription(html) {
    let count = 0;
    const editor = window.CKEDITOR;
    if (!editor || !editor.instances) return count;
    Object.keys(editor.instances).forEach((key) => {
      const instance = editor.instances[key];
      if (!instance || typeof instance.setData !== 'function') return;
      const element = instance.element && instance.element.$;
      const name = `${key} ${element && element.id ? element.id : ''} ${element && element.name ? element.name : ''}`.toLowerCase();
      if (!/ckeditor|detail|desc|web|content/.test(name)) return;
      try {
        instance.setData(html);
        if (typeof instance.updateElement === 'function') instance.updateElement();
        if (typeof instance.fire === 'function') instance.fire('change');
        count += 1;
      } catch (_) {
        // Ignore individual editor failures; hidden fields are also synchronized.
      }
    });
    return count;
  }

  function getDescriptionImageUrls() {
    const mainImages = selectPcDetailImages(getCurrentEditMainImageUrls());
    const all = Array.from(document.querySelectorAll('img'))
      .filter((img) => {
        const src = img.currentSrc || img.src || img.getAttribute('data-src') || '';
        if (!/^https?:\/\//i.test(src)) return false;
        if (/loading|addImg|logo|avatar|icon|sprite|translate|qiyukf|static\/img/i.test(src)) return false;
        const rect = img.getBoundingClientRect();
        if (rect.width < 50 || rect.height < 50) return false;
        const aspect = rect.width / Math.max(1, rect.height);
        return rect.height >= 120 && aspect < 4;
      })
      .map((img) => img.currentSrc || img.src || img.getAttribute('data-src') || '');
    const unique = Array.from(new Set(all));
    const generated = unique.filter((url) => /wxalbum|dianxiaomi/i.test(url));
    const product = unique.filter((url) => !/wxalbum|dianxiaomi/i.test(url));
    return Array.from(new Set([...mainImages, ...generated, ...product])).slice(0, EDIT_PAGE_RULES.pcDescriptionMaxImages);
  }

  function buildPcDescriptionHtml(text, imageUrls) {
    const textHtml = textToDetailWeb(text);
    const imageHtml = imageUrls
      .map((url) => {
        const safeUrl = escapeHtml(url);
        return [
          '<p style="text-align:center;margin:18px 0;">',
          `<img src="${safeUrl}" style="max-width:100%;height:auto;display:block;margin:0 auto;" />`,
          '</p>',
        ].join('');
      })
      .join('\n');
    return imageHtml ? `${imageHtml}<br>\n${textHtml}` : textHtml;
  }

  function applyVisiblePcDescriptionRule(titleValue) {
    const source = getCurrentEditComplianceSource(titleValue);
    const description = buildCompliantPcDescription(source, titleValue);
    const imageUrls = getDescriptionImageUrls();
    const html = buildPcDescriptionHtml(description, imageUrls);
    const imageState = analyzePcDetailWebImages(html, getCurrentEditMainImageUrls());
    const target = findVisiblePcDescriptionTarget();
    const hiddenCount = syncHiddenDetailFields(html);
    const ckeditorCount = syncCkeditorDescription(html);
    if (!target) {
      return {
        changed: ckeditorCount > 0 || hiddenCount > 0,
        reason: 'pc description editor not found',
        hiddenCount,
        ckeditorCount,
        imageCount: imageUrls.length,
        imageState,
        chars: description.length,
      };
    }
    const changed = target.type === 'textarea' ? setInputValue(target.node, html) : setEditableHtml(target.node, html);
    syncHiddenDetailFields(html);
    return {
      changed: changed || ckeditorCount > 0 || hiddenCount > 0,
      target: target.type,
      hiddenCount,
      ckeditorCount,
      imageCount: imageUrls.length,
      imageState,
      chars: description.length,
    };
  }

  function applyVisiblePlatformTextSanitization() {
    let changed = 0;
    const touched = [];
    const cleanInput = (node, label) => {
      const before = getInputText(node);
      const after = sanitizePlatformText(before);
      if (after !== before && setInputValue(node, after)) {
        changed += 1;
        touched.push(label);
      }
    };

    Array.from(document.querySelectorAll('input[type="text"], textarea'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && node.type !== 'hidden')
      .forEach((node) => cleanInput(node, node.name || node.id || node.getAttribute('placeholder') || 'input'));

    Array.from(document.querySelectorAll('[contenteditable="true"]'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node))
      .forEach((node) => {
        const before = node.innerHTML;
        const after = sanitizeHtmlTextContent(before);
        if (after !== before && setEditableHtml(node, after)) {
          changed += 1;
          touched.push('contenteditable');
        }
      });

    const editor = window.CKEDITOR;
    if (editor && editor.instances) {
      Object.keys(editor.instances).forEach((key) => {
        const instance = editor.instances[key];
        if (!instance || typeof instance.getData !== 'function' || typeof instance.setData !== 'function') return;
        try {
          const before = instance.getData();
          const after = sanitizeHtmlTextContent(before);
          if (after !== before) {
            instance.setData(after);
            if (typeof instance.updateElement === 'function') instance.updateElement();
            if (typeof instance.fire === 'function') instance.fire('change');
            changed += 1;
            touched.push(`ckeditor:${key}`);
          }
        } catch (_) {
          // Ignore editor instances that cannot be read or written.
        }
      });
    }

    const hiddenSelector = [
      'textarea[name*="detail" i]',
      'textarea[id*="detail" i]',
      'input[name*="detail" i]',
      'input[id*="detail" i]',
      'textarea[id^="ckeditor"]',
      'textarea[name^="ckeditor"]',
    ].join(',');
    Array.from(document.querySelectorAll(hiddenSelector)).forEach((node) => {
      if (node.closest(`#${PANEL_ID}`)) return;
      const before = getInputText(node);
      const after = sanitizeHtmlTextContent(before);
      if (after !== before && setInputValue(node, after)) {
        changed += 1;
        touched.push('hidden-detail');
      }
    });
    return { changed: changed > 0, fields: changed, touched: Array.from(new Set(touched)).slice(0, 20) };
  }

  function elementText(element) {
    return String((element && (element.innerText || element.textContent || element.value)) || '').replace(/\s+/g, ' ').trim();
  }

  function clickElement(element) {
    if (!element) return false;
    if (!isEditPage()) element.scrollIntoView({ block: 'center', inline: 'nearest' });
    if (typeof element.focus === 'function') element.focus();
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    element.click();
    return true;
  }

  function clickSelectOption(element) {
    const option = element && (element.closest('.ant-select-item-option,[role="option"]') || element);
    if (!option) return false;
    if (!isEditPage()) option.scrollIntoView({ block: 'center', inline: 'nearest' });
    const rect = option.getBoundingClientRect();
    const init = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: Math.round(rect.left + rect.width / 2),
      clientY: Math.round(rect.top + rect.height / 2),
      button: 0,
      buttons: 1,
    };
    if (window.PointerEvent) {
      option.dispatchEvent(new PointerEvent('pointerover', init));
      option.dispatchEvent(new PointerEvent('pointermove', init));
      option.dispatchEvent(new PointerEvent('pointerdown', init));
      option.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }));
    }
    option.dispatchEvent(new MouseEvent('mouseover', init));
    option.dispatchEvent(new MouseEvent('mousemove', init));
    option.dispatchEvent(new MouseEvent('mousedown', init));
    option.dispatchEvent(new MouseEvent('mouseup', { ...init, buttons: 0 }));
    option.dispatchEvent(new MouseEvent('click', { ...init, buttons: 0 }));
    return true;
  }

  function hoverSelectOption(element) {
    const option = element && (element.closest('.ant-select-item-option,[role="option"]') || element);
    if (!option) return false;
    const rect = option.getBoundingClientRect();
    const init = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: Math.round(rect.left + rect.width / 2),
      clientY: Math.round(rect.top + rect.height / 2),
      button: 0,
      buttons: 0,
    };
    if (window.PointerEvent) {
      option.dispatchEvent(new PointerEvent('pointerover', init));
      option.dispatchEvent(new PointerEvent('pointermove', init));
    }
    option.dispatchEvent(new MouseEvent('mouseover', init));
    option.dispatchEvent(new MouseEvent('mousemove', init));
    option.dispatchEvent(new MouseEvent('mouseenter', init));
    return true;
  }

  function getReactProps(element) {
    if (!element) return null;
    const key = Object.keys(element).find((name) => name.startsWith('__reactProps$'));
    return key ? element[key] : null;
  }

  function callReactHandler(element, handlerName, eventTarget) {
    const props = getReactProps(element);
    const handler = props && props[handlerName];
    if (typeof handler !== 'function') return false;
    const event = {
      type: handlerName.replace(/^on/, '').toLowerCase(),
      target: eventTarget || element,
      currentTarget: element,
      button: 0,
      buttons: 1,
      preventDefault() {},
      stopPropagation() {},
      nativeEvent: {
        target: eventTarget || element,
        currentTarget: element,
        button: 0,
        preventDefault() {},
        stopPropagation() {},
      },
    };
    handler(event);
    return true;
  }

  function forceSelectOption(element) {
    const option = element && (element.closest('.ant-select-item-option,.ant-select-dropdown-menu-item,.select2-results__option,[role="option"]') || element);
    if (!option) return false;
    const content = option.querySelector('.ant-select-item-option-content,.select2-results__option') || element || option;
    let handled = false;
    handled = callReactHandler(option, 'onMouseMove', content) || handled;
    handled = callReactHandler(option, 'onMouseDown', content) || handled;
    handled = callReactHandler(option, 'onClick', content) || handled;
    handled = callReactHandler(content, 'onMouseDown', content) || handled;
    handled = callReactHandler(content, 'onClick', content) || handled;
    return clickSelectOption(option) || handled;
  }

  function forceOpenSelectControl(container) {
    if (!container) return false;
    const candidates = Array.from(container.querySelectorAll('.ant-select-selector,.ant-select-selection,.ant-select,input[role="combobox"],input[type="search"],input[type="text"]'))
      .filter(visibleElement);
    const target = candidates.find((node) => /ant-select-selector|ant-select-selection/.test(String(node.className || '')))
      || candidates.find((node) => node.closest('.ant-select'))
      || candidates[0];
    if (!target) return false;
    const selectRoot = target.closest('.ant-select') || target;
    let handled = false;
    [selectRoot, target].forEach((node) => {
      handled = callReactHandler(node, 'onMouseDown', target) || handled;
      handled = callReactHandler(node, 'onClick', target) || handled;
      clickElement(node);
    });
    return handled || true;
  }

  function dispatchPointerMouseClickAt(element, clientX, clientY) {
    if (!element || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;
    const target = document.elementFromPoint(clientX, clientY) || element;
    if (typeof target.focus === 'function') target.focus();
    const init = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: Math.round(clientX),
      clientY: Math.round(clientY),
      button: 0,
      buttons: 1,
    };
    if (window.PointerEvent) {
      target.dispatchEvent(new PointerEvent('pointerover', init));
      target.dispatchEvent(new PointerEvent('pointermove', init));
      target.dispatchEvent(new PointerEvent('pointerdown', init));
      target.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }));
    }
    target.dispatchEvent(new MouseEvent('mouseover', init));
    target.dispatchEvent(new MouseEvent('mousemove', init));
    target.dispatchEvent(new MouseEvent('mousedown', init));
    target.dispatchEvent(new MouseEvent('mouseup', { ...init, buttons: 0 }));
    target.dispatchEvent(new MouseEvent('click', { ...init, buttons: 0 }));
    return true;
  }

  function openPostageTemplateDropdownByArrow(container) {
    if (!container) return { ok: false, reason: 'postage container not found' };
    const selectRoot = Array.from(container.querySelectorAll('.ant-select,.select2-container,.ant-select-selector,.ant-select-selection'))
      .filter(visibleElement)
      .map((node) => node.closest('.ant-select,.select2-container') || node)
      .find(visibleElement);
    if (!selectRoot) return { ok: false, reason: 'postage select root not found' };
    const opener = selectRoot.querySelector('.ant-select-selector,.ant-select-selection,.select2-selection') || selectRoot;
    const arrow = Array.from(selectRoot.querySelectorAll('.ant-select-arrow,.ant-select-selection__arrow,.select2-selection__arrow,[class*="arrow"],[class*="caret"]'))
      .filter(visibleElement)
      .sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)[0];
    if (arrow) {
      const rect = arrow.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const handled = callReactHandler(selectRoot, 'onMouseDown', arrow) || callReactHandler(opener, 'onMouseDown', arrow);
      dispatchPointerMouseClickAt(arrow, x, y);
      return { ok: true, mode: 'postage-arrow-element', opener, handled };
    }
    const rect = opener.getBoundingClientRect();
    if (!rect.width || !rect.height) return { ok: false, reason: 'postage opener has empty rect', opener };
    const x = Math.max(rect.left + 1, rect.right - Math.min(34, Math.max(22, rect.width * 0.08)));
    const y = rect.top + rect.height / 2;
    const handled = callReactHandler(selectRoot, 'onMouseDown', opener) || callReactHandler(opener, 'onMouseDown', opener);
    dispatchPointerMouseClickAt(opener, x, y);
    return { ok: true, mode: 'postage-arrow-coordinate', opener, handled };
  }

  function dispatchPointerMouseClick(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const init = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: Math.round(rect.left + rect.width / 2),
      clientY: Math.round(rect.top + rect.height / 2),
      button: 0,
      buttons: 1,
    };
    if (window.PointerEvent) {
      element.dispatchEvent(new PointerEvent('pointerover', init));
      element.dispatchEvent(new PointerEvent('pointermove', init));
      element.dispatchEvent(new PointerEvent('pointerdown', init));
      element.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }));
    }
    element.dispatchEvent(new MouseEvent('mouseover', init));
    element.dispatchEvent(new MouseEvent('mousemove', init));
    element.dispatchEvent(new MouseEvent('mousedown', init));
    element.dispatchEvent(new MouseEvent('mouseup', { ...init, buttons: 0 }));
    element.dispatchEvent(new MouseEvent('click', { ...init, buttons: 0 }));
    return true;
  }

  function getVisibleSelectDropdowns() {
    return Array.from(document.querySelectorAll(
      '.ant-select-dropdown,.ant-select-dropdown-menu,.select2-dropdown,.rc-virtual-list'
    ))
      .filter((node) => visibleElement(node))
      .filter((node) => {
        const className = String(node.className || '');
        if (className.includes('ant-select-dropdown-hidden')) return false;
        if (/ant-slide-up-leave|ant-slide-up-enter-start/i.test(className)) return false;
        return true;
      });
  }

  function getElementCenterDistance(a, b) {
    if (!a || !b || !a.getBoundingClientRect || !b.getBoundingClientRect) return Number.MAX_SAFE_INTEGER;
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    const ax = ar.left + ar.width / 2;
    const ay = ar.top + ar.height / 2;
    const bx = br.left + br.width / 2;
    const by = br.top + br.height / 2;
    return Math.hypot(ax - bx, ay - by);
  }

  function getActiveSelectDropdowns(opener) {
    const dropdowns = getVisibleSelectDropdowns();
    const input = opener && (opener.matches && opener.matches('input[role="combobox"],input[type="search"],input[type="text"]')
      ? opener
      : opener.querySelector && opener.querySelector('input[role="combobox"],input[type="search"],input[type="text"]'));
    const controls = input && (input.getAttribute('aria-controls') || input.getAttribute('aria-owns'));
    if (controls) {
      const matched = dropdowns.filter((node) => node.id === controls || node.querySelector(`#${controls}`) || node.getAttribute('id') === `${controls}_list`);
      if (matched.length) return matched;
      const byId = document.getElementById(controls);
      if (byId) {
        const root = byId.closest('.ant-select-dropdown,.ant-select-dropdown-menu,.select2-dropdown,.rc-virtual-list') || byId;
        if (visibleElement(root)) return [root];
      }
    }
    if (!opener || !dropdowns.length) return dropdowns;
    const openerRoot = opener.closest && (opener.closest('.ant-select') || opener);
    const anchor = openerRoot || opener;
    return dropdowns
      .map((node) => ({ node, distance: getElementCenterDistance(anchor, node) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 1)
      .map((item) => item.node);
  }

  function getActiveSelectScrollContainers(opener) {
    const roots = getActiveSelectDropdowns(opener);
    const holders = roots.flatMap((root) => Array.from(root.querySelectorAll(
      '.rc-virtual-list-holder,.ant-select-dropdown-menu,.ant-select-dropdown-menu-root'
    )));
    return Array.from(new Set(holders.concat(roots)))
      .filter((node) => visibleElement(node) && node.scrollHeight > node.clientHeight + 5);
  }

  function isSafeRequiredAttributeBlankTarget(node) {
    if (!node || node === document.documentElement) return false;
    if (node.closest && node.closest(`#${PANEL_ID},.ant-select-dropdown,.select2-dropdown,.rc-virtual-list`)) return false;
    const interactive = node.closest && node.closest([
      'button',
      'a',
      'input',
      'textarea',
      'select',
      '[role="button"]',
      '[contenteditable="true"]',
      '.ant-btn',
      '.ant-select',
      '.ant-checkbox',
      '.ant-radio',
      '.ant-upload',
    ].join(','));
    if (interactive) return false;
    const text = elementText(node).slice(0, 80);
    if (/保存|发布|一键生成|同步|展开|添加|删除|上传|导出/.test(text)) return false;
    return true;
  }

  function getRequiredAttributeBlankConfirmPoint(container) {
    const selectRoot = container && Array.from(container.querySelectorAll('.ant-select,.ant-select-selector,.ant-select-selection'))
      .filter(visibleElement)[0];
    const selectRect = selectRoot && selectRoot.getBoundingClientRect();
    const containerRect = container && container.getBoundingClientRect && container.getBoundingClientRect();
    const y = selectRect && selectRect.height ? selectRect.top + selectRect.height / 2 : (containerRect ? containerRect.top + Math.min(28, Math.max(12, containerRect.height / 2)) : window.innerHeight / 2);
    const candidates = [];
    if (selectRect && selectRect.width) {
      candidates.push(
        [selectRect.right + 80, y],
        [selectRect.right + 180, y],
        [selectRect.right + 320, y],
      );
    }
    if (containerRect && containerRect.width) {
      candidates.push(
        [containerRect.right - 80, y],
        [containerRect.left + containerRect.width * 0.72, y],
        [containerRect.left + containerRect.width * 0.86, y],
      );
    }
    candidates.push(
      [window.innerWidth * 0.72, y],
      [window.innerWidth * 0.82, y],
      [window.innerWidth * 0.58, Math.min(window.innerHeight - 40, Math.max(40, y + 54))],
    );
    return candidates
      .map(([x, pointY]) => ({
        x: Math.round(Math.min(window.innerWidth - 24, Math.max(24, x))),
        y: Math.round(Math.min(window.innerHeight - 24, Math.max(24, pointY))),
      }))
      .find((point) => isSafeRequiredAttributeBlankTarget(document.elementFromPoint(point.x, point.y))) || null;
  }

  async function waitForRequiredAttributeDropdownToClose(opener, timeoutMs = 1200, deadlineAt = 0) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (deadlineAt && isDeadlineExceeded(deadlineAt)) return false;
      if (!getActiveSelectDropdowns(opener).length) return true;
      await sleep(120);
    }
    return !getActiveSelectDropdowns(opener).length;
  }

  async function confirmRequiredAttributeSelection(container, opener, input, deadlineAt) {
    await sleep(180);
    if (input) {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      if (typeof input.blur === 'function') input.blur();
      input.dispatchEvent(new Event('blur', { bubbles: true }));
    }
    const point = getRequiredAttributeBlankConfirmPoint(container);
    let clickedBlank = false;
    if (point) {
      clickedBlank = dispatchPointerMouseClickAt(document.body, point.x, point.y);
      await sleep(260);
    }
    let closed = await waitForRequiredAttributeDropdownToClose(opener, 900, deadlineAt);
    if (!closed) {
      const target = input || opener || document.body;
      dispatchKeyboardEvent(target, 'keydown', 'Escape');
      dispatchKeyboardEvent(target, 'keyup', 'Escape');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
      await sleep(260);
      closed = await waitForRequiredAttributeDropdownToClose(opener, 700, deadlineAt);
    }
    return { clickedBlank, closed, point };
  }

  function normalizeSelectMatchText(value) {
    return normalizeCategoryText(value)
      .replace(/[*_\-()[\]{}]+/g, ' ')
      .replace(/\bae存量\b/g, ' ')
      .replace(/\bdefault\s*\d+\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isUnsafeSelectDisplayText(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return true;
    if (/^(?:\d{6,}|[a-z]?\d{6,})$/i.test(text)) return true;
    if (/\u8bf7\u9009\u62e9|please\s*select/i.test(text)) return true;
    return false;
  }

  function findSelectSearchInputForOpenDropdown(opener) {
    const dropdownInputs = getActiveSelectDropdowns(opener)
      .flatMap((root) => Array.from(root.querySelectorAll('input[role="combobox"],input[type="search"],input[type="text"]')))
      .filter((node) => visibleElement(node) && !node.closest(`#${PANEL_ID}`));
    if (dropdownInputs[0]) return dropdownInputs[0];
    const localInput = opener && opener.querySelector
      ? Array.from(opener.querySelectorAll('input[role="combobox"],input[type="search"],input[type="text"]')).filter(visibleElement)[0]
      : null;
    if (localInput) return localInput;
    const selectRootInput = opener && opener.closest
      ? Array.from((opener.closest('.ant-select') || opener).querySelectorAll('input[role="combobox"],input[type="search"],input[type="text"]')).filter(visibleElement)[0]
      : null;
    if (selectRootInput) return selectRootInput;
    if (opener && opener.matches && opener.matches('input[role="combobox"],input[type="search"],input[type="text"]')) return opener;
    return null;
  }

  function pressSelectAcceptKeys(input) {
    if (!input) return;
    if (typeof input.focus === 'function') input.focus();
    ['ArrowDown', 'Enter'].forEach((key) => {
      dispatchKeyboardEvent(input, 'keydown', key);
      dispatchKeyboardEvent(input, 'keypress', key);
      dispatchKeyboardEvent(input, 'keyup', key);
    });
  }

  async function pressSelectAcceptKeysSlow(input) {
    if (!input) return;
    if (typeof input.focus === 'function') input.focus();
    for (const key of ['ArrowDown', 'Enter']) {
      dispatchKeyboardEvent(input, 'keydown', key);
      dispatchKeyboardEvent(input, 'keypress', key);
      dispatchKeyboardEvent(input, 'keyup', key);
      await sleep(280);
    }
  }

  function commitSelectControl(container, input) {
    const target = input
      || Array.from((container || document).querySelectorAll('input[role="combobox"],input[type="search"],input[type="text"]')).filter(visibleElement)[0]
      || (document.activeElement && document.activeElement.matches && document.activeElement.matches('input') ? document.activeElement : null);
    if (!target) return false;
    if (typeof target.focus === 'function') target.focus();
    ['Enter', 'Tab'].forEach((key) => {
      dispatchKeyboardEvent(target, 'keydown', key);
      dispatchKeyboardEvent(target, 'keypress', key);
      dispatchKeyboardEvent(target, 'keyup', key);
    });
    target.dispatchEvent(new Event('change', { bubbles: true }));
    if (typeof target.blur === 'function') target.blur();
    target.dispatchEvent(new Event('blur', { bubbles: true }));
    return true;
  }

  function pressKey(element, key) {
    dispatchKeyboardEvent(element, 'keydown', key);
    dispatchKeyboardEvent(element, 'keypress', key);
    dispatchKeyboardEvent(element, 'keyup', key);
  }

  function getEditFormScope() {
    const anchors = ['productBasicInfo', 'attrInfo', 'packageInfo']
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    if (!anchors.length) return document.body;
    let scope = anchors[0];
    while (scope && scope !== document.body) {
      const text = elementText(scope);
      if (
        anchors.every((anchor) => scope.contains(anchor))
        || (/基本信息/.test(text) && /属性信息/.test(text) && /物流设置/.test(text))
      ) {
        return scope;
      }
      scope = scope.parentElement;
    }
    return document.body;
  }

  function findFieldContainerByText(text, scope = getEditFormScope()) {
    const nodes = Array.from(scope.querySelectorAll('label,.ant-form-item,.form-group,.row,div,td,th')).filter(visibleElement);
    const matches = nodes
      .filter((node) => elementText(node).includes(text) && node.querySelector('input,.ant-select,button'))
      .map((node) => ({ node, length: elementText(node).length, area: node.getBoundingClientRect().width * node.getBoundingClientRect().height }))
      .sort((a, b) => a.length - b.length || a.area - b.area);
    return matches[0] ? matches[0].node : null;
  }

  function findAntFormItemByLabelText(text, scope = getEditFormScope()) {
    const labels = Array.from(scope.querySelectorAll('label,.ant-form-item-label'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node))
      .map((node) => ({ node, text: elementText(node), title: String(node.getAttribute('title') || '').trim() }))
      .filter((item) => item.text === text || item.title === text || elementText(item.node.querySelector && item.node.querySelector('label')).trim() === text);
    for (const item of labels) {
      const root = item.node.closest('.ant-form-item,.form-group,.row,tr,td');
      if (root && root.querySelector('input,.ant-select,select,button')) return root;
    }
    return null;
  }

  function findPostageTemplateContainer() {
    return findAntFormItemByLabelText('\u8fd0\u8d39\u6a21\u677f') || findFieldContainerByText('\u8fd0\u8d39\u6a21\u677f') || getEditFormScope();
  }

  function findVisibleSelectOptionExact(value) {
    const textValue = String(value);
    const visibleDropdowns = getVisibleSelectDropdowns();
    const roots = visibleDropdowns.length ? visibleDropdowns : [document];
    for (const root of roots) {
      const options = Array.from(root.querySelectorAll('.ant-select-item-option,.ant-select-dropdown-menu-item,.select2-results__option,[role="option"],li'))
        .filter(visibleElement);
      const exact = options.find((node) => elementText(node) === textValue || String(node.getAttribute('title') || '').trim() === textValue);
      if (exact) return exact;
      const contentExact = Array.from(root.querySelectorAll('.ant-select-item-option-content'))
        .filter(visibleElement)
        .find((node) => elementText(node) === textValue);
      if (contentExact) return contentExact.closest('.ant-select-item-option,[role="option"]') || contentExact;
      const contains = options.find((node) => elementText(node).split(/\s+/).includes(textValue));
      if (contains) return contains;
      const fallback = Array.from(root.querySelectorAll('div,span'))
        .filter(visibleElement)
        .map((node) => ({ node, text: elementText(node), rect: node.getBoundingClientRect() }))
        .filter((item) => item.text === textValue && item.rect.width > 10 && item.rect.height > 10)
        .sort((a, b) => a.rect.width * a.rect.height - b.rect.width * b.rect.height)[0];
      if (fallback) return fallback.node.closest('.ant-select-item-option,[role="option"]') || fallback.node;
    }
    return null;
  }

  function clearSelectSearchValue(container) {
    Array.from(container.querySelectorAll('input[role="combobox"],input[type="search"]')).forEach((input) => {
      setInputValue(input, '');
    });
  }

  function getAntSelectValueInfo(container) {
    if (!container) return { selectedText: '', itemTitle: '', inputValue: '', okText: '', hasCommittedOption: false };
    const selectedNodes = Array.from(container.querySelectorAll(
      '.ant-select-selection-item,.ant-select-selection-selected-value,.ant-select-selection__choice__content,.select2-selection__rendered'
    ))
      .filter(visibleElement);
    const selectedText = selectedNodes.map((node) => elementText(node)).find(Boolean) || '';
    const itemTitle = selectedNodes.map((node) => String(node.getAttribute('title') || '').trim()).find(Boolean) || '';
    const input = Array.from(container.querySelectorAll('input[role="combobox"],input[type="search"],input[type="text"]'))
      .filter(visibleElement)[0];
    const inputValue = input ? getInputText(input) : '';
    const hasCommittedOption = Boolean(selectedText || itemTitle);
    const okText = firstNonEmpty(selectedText, itemTitle, inputValue, getSelectedTextInContainer(container));
    return { selectedText, itemTitle, inputValue, okText, hasCommittedOption };
  }

  function getSelectValidationIssue(container) {
    if (!container) return '';
    const formItem = container.closest && container.closest('.ant-form-item') ? container.closest('.ant-form-item') : container;
    const classText = String(`${formItem.className || ''} ${container.className || ''} ${Array.from(container.querySelectorAll('.ant-select-status-error')).map((node) => node.className).join(' ')}`);
    if (!/ant-form-item-has-error|ant-select-status-error/i.test(classText)) return '';
    const text = elementText(formItem);
    if (/\u8bf7\u9009\u62e9|\u5fc5\u586b|required|select|product attribute|\u4ea7\u54c1\u5c5e\u6027/i.test(text)) return text.slice(0, 180);
    return 'field validation error';
  }

  function verifySelectContainerValue(container, values, options = {}) {
    const info = getAntSelectValueInfo(container);
    const validationIssue = getSelectValidationIssue(container);
    const committedOk = !options.requireCommittedOption || info.hasCommittedOption;
    const unsafeDisplay = isUnsafeSelectDisplayText(info.okText);
    return {
      ...info,
      validationIssue,
      unsafeDisplay,
      ok: committedOk && (!validationIssue || options.allowValidationIssue) && !unsafeDisplay && selectedTextMatchesCandidateValues(info.okText, values),
    };
  }

  async function waitForSelectContainerValue(container, values, timeoutMs = 1200, options = {}) {
    const start = Date.now();
    const deadlineAt = getDeadlineAt(options);
    let last = verifySelectContainerValue(container, values, options);
    while (Date.now() - start < timeoutMs && !isDeadlineExceeded(deadlineAt)) {
      if (last.ok) return last;
      await sleep(120);
      last = verifySelectContainerValue(container, values, options);
    }
    if (isDeadlineExceeded(deadlineAt)) {
      return { ...last, timedOut: true, reason: 'select value wait timed out' };
    }
    return last;
  }

  function getDeadlineAt(options = {}) {
    const value = Number(options.deadlineAt || 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  function isDeadlineExceeded(deadlineAt) {
    return Boolean(deadlineAt && Date.now() >= deadlineAt);
  }

  function makeDeadlineAt(timeoutMs) {
    const value = Number(timeoutMs || 0);
    return Number.isFinite(value) && value > 0 ? Date.now() + value : 0;
  }

  function getRecoverStageTimeoutMs(options = {}, fallback = 0) {
    const value = Number(options.stageTimeoutMs || options.timeoutMs || fallback || 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  function buildStageTimeoutResult(stageId, deadlineAt, extra = {}) {
    return {
      ...extra,
      changed: Boolean(extra.changed),
      ok: false,
      locked: Boolean(extra.locked),
      timedOut: true,
      stoppedAt: stageId,
      reason: `stage timeout: ${stageId}`,
      timeoutDetail: extra.reason || extra.timeoutDetail || '',
      deadlineAt: deadlineAt ? new Date(deadlineAt).toISOString() : '',
    };
  }

  async function clearMismatchedSelectValue(container, values) {
    const info = getAntSelectValueInfo(container);
    if (isBlankSelectionText(info.okText) || (!isUnsafeSelectDisplayText(info.okText) && selectedTextMatchesCandidateValues(info.okText, values))) return false;
    const controls = Array.from(container.querySelectorAll('.ant-select-selection-item-remove,.ant-select-clear,.select2-selection__clear'))
      .filter(visibleElement);
    let changed = false;
    for (const control of controls) {
      clickElement(control);
      changed = true;
      await sleep(180);
    }
    const input = Array.from(container.querySelectorAll('input[role="combobox"],input[type="search"],input[type="text"]'))
      .filter(visibleElement)[0];
    if (input && getInputText(input)) {
      setSelectSearchInputValue(input, '');
      input.dispatchEvent(new Event('change', { bubbles: true }));
      changed = true;
    }
    if (changed) await sleep(350);
    return changed;
  }

  async function selectAntLikeValue(container, values, options = {}) {
    return selectLockedDropdownOption(container, values, {
      confirmWithKeyboard: options.confirmWithKeyboard !== false,
      hoverKeyboardOnly: options.hoverKeyboardOnly,
      skipKeyboardCommit: options.skipKeyboardCommit,
      prefilterFirstValue: false,
      requireCommittedOption: true,
      allowSafeVisibleOptionFallback: Boolean(options.allowSafeVisibleOptionFallback),
      safeFallbackKind: options.safeFallbackKind || 'generic',
      deadlineAt: options.deadlineAt,
      timeoutStage: options.timeoutStage,
    });
  }

  async function selectPostageTemplate111(options = {}) {
    const deadlineAt = getDeadlineAt(options);
    const timeoutStage = options.timeoutStage || 'shipping-postage';
    const timeout = (extra = {}) => buildStageTimeoutResult(timeoutStage, deadlineAt, extra);
    const container = findPostageTemplateContainer();
    if (isDeadlineExceeded(deadlineAt)) return timeout({ reason: 'postage stage timeout before start' });
    const nativeSelect = Array.from(container.querySelectorAll('select')).find(visibleElement);
    if (nativeSelect) {
      const option = Array.from(nativeSelect.options || []).find((item) => {
        return isExactPostageTemplate111OptionText(item.text || item.label, item.getAttribute && item.getAttribute('title'));
      });
      if (option) {
        nativeSelect.value = option.value;
        dispatchInputEvents(nativeSelect);
        const selectedText = getCommittedPostageTemplateText(container);
        return { changed: true, ok: isExactPostageTemplate111Text(selectedText), value: EDIT_PAGE_RULES.postageTemplateId, selectedText, mode: 'native-select' };
      }
    }
    const selectors = [
      '.ant-select-selector',
      '.ant-select-selection',
      '.ant-select',
      'input[role="combobox"]',
      'input[type="search"]',
      'input[type="text"]',
    ];
    let opener = null;
    for (const selector of selectors) {
      opener = Array.from(container.querySelectorAll(selector)).find(visibleElement);
      if (opener) break;
    }
    if (!opener) return { changed: false, ok: false, reason: 'postage selector not found' };
    const getSelectedText = () => {
      return getCommittedPostageTemplateText(container);
    };
    const antResult = { skipped: true, reason: 'postage template uses exact visible option only' };
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: false, attempts: attempt, antResult });
      clearSelectSearchValue(container);
      forceOpenSelectControl(container) || clickElement(opener);
      await sleep(400);
      if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: false, attempts: attempt + 1, antResult });
      let option = findExactPostageTemplate111Option(opener);
      if (option) {
        forceSelectOption(option);
        await sleep(500);
        const selectedText = getSelectedText();
        if (isExactPostageTemplate111Text(selectedText)) {
          return { changed: true, ok: true, value: EDIT_PAGE_RULES.postageTemplateId, selectedText, attempts: attempt + 1, mode: 'direct-option' };
        }
      }
      await sleep(600);
      if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: false, attempts: attempt + 1, antResult });
      option = await findExactPostageTemplate111OptionWithListScroll(opener, { deadlineAt });
      if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: false, attempts: attempt + 1, antResult });
      if (option) {
        forceSelectOption(option);
        await sleep(500);
      }
      const selectedText = getSelectedText();
      if (isExactPostageTemplate111Text(selectedText)) {
        return { changed: true, ok: true, value: EDIT_PAGE_RULES.postageTemplateId, selectedText, attempts: attempt + 1 };
      }
    }
    clearSelectSearchValue(container);
    return { changed: false, ok: false, reason: 'postage option 111 not selected', selectedText: getSelectedText(), attempts: 3, antResult };
  }

  async function selectPostageTemplate111FastPath(options = {}) {
    const deadlineAt = getDeadlineAt(options);
    const timeout = (extra = {}) => buildStageTimeoutResult(options.timeoutStage || 'shipping-postage.fast-postage', deadlineAt, extra);
    const container = findPostageTemplateContainer();
    const selectedBefore = getCommittedPostageTemplateText(container);
    if (isExactPostageTemplate111Text(selectedBefore)) {
      return { changed: false, ok: true, value: EDIT_PAGE_RULES.postageTemplateId, selectedText: selectedBefore, mode: 'fast-already-selected' };
    }
    if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: false, reason: 'fast postage timeout before start', selectedText: selectedBefore });
    const nativeSelect = Array.from(container.querySelectorAll('select')).find(visibleElement);
    if (nativeSelect) {
      const option = Array.from(nativeSelect.options || []).find((item) => {
        return isExactPostageTemplate111OptionText(item.text || item.label, item.getAttribute && item.getAttribute('title'));
      });
      if (option) {
        nativeSelect.value = option.value;
        dispatchInputEvents(nativeSelect);
        const selectedText = getCommittedPostageTemplateText(container);
        return { changed: true, ok: isExactPostageTemplate111Text(selectedText), value: EDIT_PAGE_RULES.postageTemplateId, selectedText, mode: 'fast-native-select' };
      }
    }
    const opener = Array.from(container.querySelectorAll('.ant-select-selector,.ant-select-selection,.ant-select,input[role="combobox"],input[type="search"],input[type="text"]'))
      .find(visibleElement);
    if (!opener) return { changed: false, ok: false, reason: 'postage selector not found', selectedText: selectedBefore };
    const openResult = openPostageTemplateDropdownByArrow(container);
    if (!openResult.ok) clickElement(opener);
    await sleep(250);
    if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: false, reason: 'fast postage timeout after open', selectedText: getCommittedPostageTemplateText(container) });
    const dropdownOpener = (openResult && openResult.opener) || opener;
    let option = findExactPostageTemplate111Option(dropdownOpener);
    if (!option) option = await findExactPostageTemplate111OptionWithListScroll(dropdownOpener, { deadlineAt });
    if (!option) {
      const selectedText = getCommittedPostageTemplateText(container);
      return { changed: false, ok: false, reason: 'postage option 111 not visible in fast path', selectedText, mode: 'fast-option-not-visible', openResult };
    }
    forceSelectOption(option);
    await sleep(350);
    const selectedText = getCommittedPostageTemplateText(container);
    return {
      changed: true,
      ok: isExactPostageTemplate111Text(selectedText),
      value: EDIT_PAGE_RULES.postageTemplateId,
      selectedText,
      mode: 'fast-visible-option',
      openResult,
      reason: isExactPostageTemplate111Text(selectedText) ? '' : 'fast postage did not read back exact 111',
    };
  }

  function getSelectedTextInContainer(container) {
    if (!container) return '';
    const selected = Array.from(container.querySelectorAll('.ant-select-selection-item,.ant-select-selection-selected-value,.ant-select-selection__choice__content,.ant-select-selection-placeholder,.select2-selection__rendered,input[type="text"]'))
      .filter(visibleElement)
      .map((node) => elementText(node) || getInputText(node))
      .find(Boolean);
    if (selected) return String(selected).trim();
    const comboboxValue = Array.from(container.querySelectorAll('input[role="combobox"],input[type="search"]'))
      .filter(visibleElement)
      .map((node) => getInputText(node))
      .find(Boolean);
    return String(comboboxValue || '').trim();
  }

  function isBlankSelectionText(text) {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return true;
    return /\u8bf7\u9009\u62e9|\u672a\u9009\u62e9|select\s+category|choose\s+category/i.test(normalized);
  }

  function isDrawerStorageProductText(text) {
    const planned = buildCategoryModalSearchPlan(text);
    if (planned && planned.id === 'bathroom-soap-dish') return false;
    return /drawer\s+organizer|drawer\s+organizers|organizer\s+tray|storage\s+tray|storage\s+bin|acrylic\s+organizer|plastic\s+drawer/i.test(String(text || ''));
  }

  function isWrongDrawerStorageCategory(text) {
    return /\u5185\u8863|\u8863\u7269\u6536\u7eb3|underwear|clothing\s*&?\s*wardrobe/i.test(String(text || ''));
  }

  function isGoodDrawerStorageCategory(text) {
    const value = String(text || '');
    return /\u5bb6\u5c45\u7528\u54c1|home\s*&\s*garden|\u5bb6\u7528\u50a8\u5b58|\u6536\u7eb3|home\s+storage|home\s+office\s+storage|storage\s+box/i.test(value) && !isWrongDrawerStorageCategory(value);
  }

  function buildCategoryModalSearchPlan(titleText) {
    const source = String(titleText || '');
    const product = getProductFromEdit(state.editData) || {};
    const asinEvidencePlan = buildCategoryModalPlanFromAliExpressEvidenceStore(source, product);
    if (asinEvidencePlan) return asinEvidencePlan;
    const evidencePlan = buildCategoryModalPlanFromEvidence(source, product);
    if (evidencePlan) return evidencePlan;
    if (REQUIRE_ALIEXPRESS_CATEGORY_EVIDENCE) return null;
    const plans = [
      {
        id: 'bathroom-soap-dish',
        pattern: /\bsoap\s+(?:dish|dishes|holder|holders|tray|trays|saver|savers)\b|\bself\s+draining\s+sink\s+organizer\s+tray\b/i,
        topTerms: ['\u6d74\u5ba4', 'Bathroom Products', 'Soap Dish'],
        columnTerms: ['\u6d74\u5ba4\u7528\u54c1', 'Bathroom Products', '\u6d74\u5ba4\u914d\u4ef6', 'Bathroom Accessories', '\u80a5\u7682\u76d2', 'Soap Dish'],
        leafTerms: ['\u4fbf\u643a\u80a5\u7682\u76d2', 'Portable Soap Dishes', 'Portable Soap Dish', '\u80a5\u7682\u76d2'],
        rejectTerms: ['Bath Baskets', '\u6c90\u6d74\u7bee', 'Bathroom Accessories Sets', '\u6d74\u5ba4\u914d\u4ef6\u5957\u88c5', 'Soap Box'],
      },
      {
        id: 'desk-pen-holder',
        pattern: /\b(?:pen|pencil)\s+(?:holder|holders|cup|cups|organizer|organizers)\b|\bdesk\s+pen\b|\bart\s+supply\s+pencil\b/i,
        topTerms: ['\u529e\u516c', '\u7b14\u7b52', 'Office Supplies'],
        columnTerms: ['\u529e\u516c', '\u684c\u4e0a\u6536\u7eb3', '\u7b14\u7b52', 'Desk Accessories', 'Pen Holders'],
        leafTerms: ['Pen Holders', '\u7b14\u7b52', 'Pencil Holders', 'Desk Pen Holder'],
        rejectTerms: ['Cable', '\u7ebf\u7f06', '\u53a8\u623f', '\u6d74\u5ba4'],
      },
      {
        id: 'adhesive-wall-hooks',
        pattern: /\b(?:adhesive|wall|utility)\s+hooks?\b|\bhooks?\b.*\b(?:wall|adhesive|towel|coat)\b/i,
        topTerms: ['\u6302\u94a9', '\u5bb6\u5c45', 'Hooks'],
        columnTerms: ['\u6302\u94a9', '\u5899\u6302', '\u6d74\u5ba4\u6302\u94a9', 'Hooks', 'Wall Hooks', 'Bathroom Hooks'],
        leafTerms: ['Hooks', '\u6302\u94a9', 'Bathroom Hooks', 'Wall Hooks'],
        rejectTerms: ['Faucet', '\u6c34\u9f99\u5934', 'Cable'],
      },
      {
        id: 'kitchen-sink-strainer',
        pattern: /\b(?:sink|drain)\s+(?:strainer|filter|catcher|stopper)s?\b|\bkitchen\s+sink\b/i,
        topTerms: ['\u6c34\u69fd', 'Sink', 'Drain', 'Strainer', '\u6ee4\u7f51'],
        columnTerms: ['\u6c34\u69fd', '\u53a8\u623f\u8bbe\u65bd', '\u53a8\u623f\u6c34\u69fd\u914d\u4ef6', '\u8fc7\u6ee4', '\u6ee4\u7f51', 'Kitchen Fixture', 'Kitchen Sink Accessories', 'Kitchen Drains'],
        leafTerms: ['\u53a8\u623f\u6c34\u69fd\u6c34\u6f0f\u3001\u8fc7\u6ee4\u7f51', 'Kitchen Drains & Strainers', 'Kitchen Sink Accessories', 'Sink Strainer', 'Drain Strainer', 'Kitchen Sink Strainer', '\u6c34\u69fd\u8fc7\u6ee4', '\u6c34\u69fd\u6ee4\u7f51'],
        rejectTerms: ['Faucet', '\u6c34\u9f99\u5934', 'Soap Dish', '\u80a5\u7682', 'Commercial Kitchen', 'Appliance', '\u5546\u7528\u9910\u53a8', '\u7535\u5668', 'Bathroom', '\u6d74\u5ba4', 'Colanders', '\u6f0f\u52fa'],
      },
      {
        id: 'adhesive-cable-clips',
        pattern: /\b(?:cable|cord|wire)\b.{0,40}\b(?:clip|clips|holder|holders|organizer|organizers|management)\b|\b(?:clip|clips|holder|holders|organizer|organizers)\b.{0,40}\b(?:cable|cord|wire)\b/i,
        topTerms: ['\u529e\u516c', 'Office & School Supplies', 'Cable Organizers'],
        columnTerms: ['\u529e\u516c', '\u684c\u4e0a\u6536\u7eb3', '\u684c\u9762\u7406\u7ebf\u5668', 'Desk Accessories', 'Cable Organizers'],
        leafTerms: ['\u684c\u9762\u7406\u7ebf\u5668', 'Cable Organizers'],
        rejectTerms: ['Pen', '\u7b14\u7b52', 'Hooks', '\u6302\u94a9', 'Conductive', 'Glue Paste', '\u5bfc\u7535', '\u80f6\u818f', 'Cable Tools', '\u7ebf\u7f06\u5de5\u5177'],
      },
      {
        id: 'cabinet-bumpers',
        pattern: /\b(?:cabinet|cupboard|drawer|door|furniture)\b.{0,50}\b(?:bumper|bumpers|pad|pads|buffer|buffers)\b|\b(?:bumper|bumpers)\b.{0,50}\b(?:cabinet|cupboard|drawer|door|furniture)\b/i,
        topTerms: ['\u5bb6\u88c5', 'Home Improvement', 'Cabinet Bumpers'],
        columnTerms: ['\u4e94\u91d1', '\u5bb6\u5177\u4e94\u91d1', 'Hardware', 'Furniture Hardware', 'Cabinet Bumpers'],
        leafTerms: ['\u67dc\u95e8\u6d88\u97f3\u57ab', 'Cabinet Bumpers'],
        rejectTerms: ['Pen', '\u7b14\u7b52', 'Cable', '\u7ebf\u7f06', 'Soap', '\u80a5\u7682'],
      },
      {
        id: 'toothbrush-holder',
        pattern: /\btooth\s*brush\b.{0,50}\b(holder|holders|stand|stands|organizer|organizers)\b|\btoothpaste\b.{0,40}\b(holder|holders|stand|stands)\b/i,
        topTerms: ['\u5bb6\u5c45', 'Home & Garden', 'Bathroom Products'],
        columnTerms: ['\u6d74\u5ba4\u7528\u54c1', 'Bathroom Products', 'Toothbrush'],
        leafTerms: ['\u7259\u818f\u67b6/\u7259\u5237\u67b6', 'Toothbrush & Toothpaste Holders'],
        rejectTerms: ['Soap Dish', '\u80a5\u7682', 'Bath Baskets', '\u6c90\u6d74\u7bee'],
      },
      {
        id: 'shower-caddy-bath-basket',
        pattern: /\b(?:shower|bath|bathroom)\b.{0,40}\b(?:caddy|caddies|basket|baskets|shelf|shelves)\b|\b(?:caddy|caddies)\b.{0,40}\b(?:shower|bath|bathroom)\b/i,
        topTerms: ['\u5bb6\u5c45', 'Home & Garden', 'Bathroom Products'],
        columnTerms: ['\u6d74\u5ba4\u7528\u54c1', 'Bathroom Products', 'Bath Baskets'],
        leafTerms: ['\u6c90\u6d74\u7bee', 'Bath Baskets'],
        rejectTerms: ['Soap Dish', '\u80a5\u7682', 'Toothbrush', '\u7259\u5237'],
      },
      {
        id: 'kitchen-racks-holders',
        pattern: /\b(?:kitchen|utensil|paper\s+towel)\b.{0,50}\b(?:holder|holders|rack|racks|stand|stands|organizer|organizers)\b/i,
        topTerms: ['\u5bb6\u5c45', 'Home & Garden', 'Kitchen Storage'],
        columnTerms: ['\u5bb6\u7528\u50a8\u5b58', '\u53a8\u623f\u6536\u7eb3', 'Kitchen Storage', 'Racks & Holders'],
        leafTerms: ['\u6536\u7eb3\u67b6', 'Racks & Holders'],
        rejectTerms: ['Toothbrush', '\u7259\u5237', 'Bath Baskets', '\u6c90\u6d74\u7bee', 'Cabinet Bumpers', '\u67dc\u95e8\u6d88\u97f3\u57ab'],
      },
    ];
    return plans.find((plan) => plan.pattern.test(source)) || null;
  }

  function categoryTextMatchesModalPlan(text, plan) {
    if (!text || !plan) return false;
    const normalized = normalizeCategoryText(text);
    if (categoryTextRejectedByModalPlan(text, plan)) return false;
    if (isStrictDxmCandidatePlan(plan)) return Boolean(scoreStrictDxmCategoryCandidate(text, plan.leafTerms || []));
    if (plan.exactDxmOnly) return Boolean(scoreExactDxmCategoryCandidate(text, plan.leafTerms || []));
    return (plan.leafTerms || []).some((term) => {
      const wanted = normalizeCategoryText(term);
      const match = scoreCategoryModalWantedMatch(normalized, wanted);
      return match && match.safe;
    });
  }

  function categoryTextRejectedByModalPlan(text, plan) {
    if (!text || !plan) return false;
    const normalized = normalizeCategoryText(text);
    return (plan.rejectTerms || []).some((term) => {
      const rejected = normalizeCategoryText(term);
      return rejected && normalized.includes(rejected);
    });
  }

  function splitCategoryCandidateSegments(text) {
    return String(text || '')
      .split(/[>/|｜、，,]/)
      .map((item) => normalizeCategoryText(item))
      .filter(Boolean);
  }

  function isStrictDxmCandidatePlan(plan) {
    return Boolean(plan && plan.strictDxmCandidateOnly);
  }

  function buildStrictDxmLeafTerms(leafText) {
    const raw = String(leafText || '').replace(/\s+/g, ' ').trim();
    if (!raw) return [];
    const terms = [raw];
    const withoutParen = raw.replace(/[\(（][^\)）]+[\)）]/g, ' ').replace(/\s+/g, ' ').trim();
    if (withoutParen) terms.push(withoutParen);
    raw.replace(/[\(（]([^\)）]+)[\)）]/g, (_, inner) => {
      const text = String(inner || '').replace(/\s+/g, ' ').trim();
      if (text) terms.push(text);
      return '';
    });
    return [...new Set(terms.map((item) => normalizeCategoryText(item)).filter((item) => item && !isGenericCategoryModalText(item)))];
  }

  function scoreStrictDxmCategoryCandidate(candidateText, wantedTerms) {
    const candidate = normalizeCategoryText(candidateText);
    if (!candidate) return null;
    const segments = splitCategoryCandidateSegments(candidateText);
    const wanted = (wantedTerms || []).flatMap(buildStrictDxmLeafTerms).filter(Boolean);
    for (let index = 0; index < wanted.length; index += 1) {
      const term = wanted[index];
      if (candidate === term) return { safe: true, score: 1.75, kind: 'strict-dxm-leaf-exact', wantedIndex: index };
      if (candidate.includes(term)) return { safe: true, score: 1.55, kind: 'strict-dxm-leaf-contained', wantedIndex: index };
      const segmentMatch = segments.find((segment) => segment === term || segment.includes(term));
      if (segmentMatch) return { safe: true, score: 1.45, kind: 'strict-dxm-leaf-segment', wantedIndex: index };
    }
    return null;
  }

  function scoreExactDxmCategoryCandidate(candidateText, wantedTerms) {
    const candidate = normalizeCategoryText(candidateText);
    if (!candidate) return null;
    const segments = splitCategoryCandidateSegments(candidateText);
    const wanted = (wantedTerms || []).map((term) => normalizeCategoryText(term)).filter(Boolean);
    for (let index = 0; index < wanted.length; index += 1) {
      const term = wanted[index];
      if (candidate === term) return { safe: true, score: 1.6, kind: 'exact-dxm-full', wantedIndex: index };
      const segmentMatch = segments.find((segment) => (
        segment === term
        || (segment.includes(term) && segment.length <= term.length + 32)
        || (term.includes(segment) && segment.length >= Math.min(6, term.length))
      ));
      if (segmentMatch) return { safe: true, score: 1.45, kind: 'exact-dxm-leaf', wantedIndex: index };
    }
    return null;
  }

  function isGenericCategoryModalText(normalized) {
    const text = normalizeCategoryText(normalized);
    if (!text) return true;
    if (/^(home\s*&\s*garden|home improvement|office\s*&\s*school supplies|consumer electronics|tools|hardware|kitchen|bathroom|storage|organization|accessories|home products|home storage|家居用品|家装|办公、文化及教育用品|厨房|浴室|收纳|配件|五金)$/.test(text)) return true;
    return text.length <= 3 && !/[a-z]/i.test(text);
  }

  function scoreCategoryModalWantedMatch(candidateNormalized, wantedNormalized) {
    const candidate = normalizeCategoryText(candidateNormalized);
    const wanted = normalizeCategoryText(wantedNormalized);
    if (!candidate || !wanted) return null;
    if (candidate === wanted) return { safe: true, score: 1.35, kind: 'exact' };
    if (candidate.includes(wanted)) return { safe: true, score: 1.12, kind: 'candidate-contains-wanted' };
    if (wanted.includes(candidate)) {
      if (isGenericCategoryModalText(candidate)) return { safe: false, score: 0, kind: 'generic-prefix' };
      if (candidate.length < 6 && !/[a-z]/i.test(candidate)) return { safe: false, score: 0, kind: 'too-short-prefix' };
      return { safe: true, score: 0.72, kind: 'candidate-contained-by-wanted' };
    }
    return null;
  }

  function scoreCategoryModalListCandidate(item, wanted, plan) {
    if (plan && categoryTextRejectedByModalPlan(item.text, plan)) return null;
    if (isStrictDxmCandidatePlan(plan)) {
      const strict = scoreStrictDxmCategoryCandidate(item.text, plan.leafTerms || []);
      if (!strict) return null;
      return {
        ...item,
        wantedIndex: strict.wantedIndex,
        matchKind: strict.kind,
        score: strict.score + Math.max(0, 220 - item.text.length) / 1600,
        familyScore: { familyId: '', blocked: false, bonus: 0, penalty: 0, reason: '' },
      };
    }
    if (plan && plan.exactDxmOnly) {
      const exact = scoreExactDxmCategoryCandidate(item.text, plan.leafTerms || []);
      if (!exact) return null;
      return {
        ...item,
        wantedIndex: exact.wantedIndex,
        matchKind: exact.kind,
        score: exact.score + Math.max(0, 220 - item.text.length) / 1600,
        familyScore: { familyId: '', blocked: false, bonus: 0, penalty: 0, reason: '' },
      };
    }
    const matched = wanted
      .map((value, index) => ({ index, match: scoreCategoryModalWantedMatch(item.normalized, value) }))
      .filter((entry) => entry.match && entry.match.safe)
      .sort((a, b) => b.match.score - a.match.score || a.index - b.index)[0];
    if (!matched) return null;
    const familyContext = plan
      ? `${plan.id || ''} ${(plan.topTerms || []).join(' ')} ${(plan.columnTerms || []).join(' ')} ${(plan.leafTerms || []).join(' ')}`
      : '';
    const familyScore = scoreCategoryFamilyCandidateText(item.text, familyContext);
    if (familyScore.blocked) return null;
    let score = matched.match.score - matched.index * 0.06;
    score += Math.max(0, 260 - item.text.length) / 1300;
    if (familyScore.bonus) score += familyScore.bonus;
    if (familyScore.penalty) score -= familyScore.penalty;
    if (isGenericCategoryModalText(item.normalized)) score -= 0.45;
    if (score < 0.65) return null;
    return {
      ...item,
      wantedIndex: matched.index,
      matchKind: matched.match.kind,
      score,
      familyScore,
    };
  }

  function getCurrentEditTitleText() {
    const titleInput = findProductTitleInput();
    return firstNonEmpty(titleInput ? getInputText(titleInput) : '', (getProductFromEdit(state.editData) || {}).subject, '');
  }

  function findProductCategoryContainer() {
    const label = '\u4ea7\u54c1\u5206\u7c7b';
    const directCategoryItem = Array.from(document.querySelectorAll('.category-item,.ant-form-item'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node))
      .map((node) => ({ node, text: elementText(node), rect: node.getBoundingClientRect() }))
      .filter((item) => item.text.includes(label) && /\u9009\u62e9\u5206\u7c7b|Storage Boxes\s*&\s*Bins|\u6536\u7eb3\u76d2\u548c\u6536\u7eb3\u7bb1/i.test(item.text))
      .sort((a, b) => a.text.length - b.text.length || a.rect.top - b.rect.top)[0];
    if (directCategoryItem) return directCategoryItem.node;
    const nodes = Array.from(document.querySelectorAll('.ant-form-item,.form-group,.row,div,td,tr'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node))
      .filter((node) => {
        const text = elementText(node);
        if (!text.includes(label) || !node.querySelector('.ant-select,input,button')) return false;
        if (/\u8d44\u8d28\u4fe1\u606f|\u5237\u65b0\u8d44\u8d28\u4fe1\u606f|GPSR|CPC/.test(text)) return false;
        return true;
      });
    const ranked = nodes
      .map((node) => ({ node, text: elementText(node), rect: node.getBoundingClientRect() }))
      .filter((item) => item.text.length < 500)
      .sort((a, b) => a.text.length - b.text.length || a.rect.top - b.rect.top);
    return ranked[0] ? ranked[0].node : findFieldContainerByText(label);
  }

  function getProductCategorySelectedText() {
    const container = findProductCategoryContainer();
    const selectedText = getSelectedTextInContainer(container);
    if (!isBlankSelectionText(selectedText)) {
      return {
        container,
        selectedText,
      };
    }
    const fallbackText = container
      ? Array.from(container.querySelectorAll('div,span,p'))
        .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node))
        .map((node) => elementText(node))
        .map((text) => String(text || '').replace(/\s+/g, ' ').trim())
        .filter((text) => text && text.length < 500)
        .find((text) => /Storage Boxes\s*&\s*Bins|\u6536\u7eb3\u76d2\u548c\u6536\u7eb3\u7bb1|Home Storage\s*&\s*Organization|\u5bb6\u7528\u50a8\u5b58\u6536\u85cf\u7528\u5177/i.test(text) && !isBlankSelectionText(text))
      : '';
    return {
      container,
      selectedText: fallbackText || selectedText,
    };
  }

  function buildVisibleCategoryTerms() {
    const product = getProductFromEdit(state.editData) || {};
    const titleInput = findProductTitleInput();
    const title = firstNonEmpty(
      titleInput ? getInputText(titleInput) : '',
      product.subject,
      product.title,
      product.productTitle,
      ''
    );
    const payload = {
      subject: title,
      categoryName: firstNonEmpty(product.categoryName, product.sourceCategoryName, ''),
    };
    const terms = [];
    const push = (value) => {
      const text = String(value || '').replace(/\s+/g, ' ').trim();
      if (text && !terms.some((item) => item.toLowerCase() === text.toLowerCase())) terms.push(text);
    };
    const evidencePlan = buildCategoryModalPlanFromEvidence(title, product);
    if (evidencePlan) {
      [
        ...(evidencePlan.topTerms || []),
        ...(evidencePlan.columnTerms || []),
        ...(evidencePlan.leafTerms || []),
      ].forEach(push);
    }
    pushCategoryMappingTerms(
      [
        title,
        product.subject,
        product.title,
        product.productTitle,
        product.categoryName,
        product.categoryNameZh,
        product.sourceCategoryName,
      ].join(' '),
      push
    );
    push(product.categoryName);
    push(product.categoryNameZh);
    push(product.sourceCategoryName);
    push(product.sourceCategoryNameZh);
    buildCategorySearchTerms(payload, product, getAmazonBatchItem(product)).forEach(push);
    return terms.slice(0, 12);
  }

  function categoryOptionMatchesTerm(optionText, term) {
    const option = normalizeCategoryText(optionText);
    const wanted = normalizeCategoryText(term);
    if (!option || !wanted) return false;
    if (option === wanted || option.includes(wanted)) return true;
    const wantedTokens = tokenizeCategoryTitle(wanted);
    const optionTokens = tokenizeCategoryTitle(option);
    if (!wantedTokens.length) return false;
    const matched = wantedTokens.filter((token) => optionTokens.includes(token)).length;
    return matched >= Math.max(2, Math.ceil(wantedTokens.length * 0.75));
  }

  function findVisibleCategoryOptionForTerms(terms) {
    const visibleDropdowns = Array.from(document.querySelectorAll('.ant-select-dropdown')).filter((node) => {
      if (!visibleElement(node)) return false;
      return !String(node.className || '').includes('ant-select-dropdown-hidden');
    });
    const roots = visibleDropdowns.length ? visibleDropdowns : [document];
    for (const root of roots) {
      const options = Array.from(root.querySelectorAll('.ant-select-item-option,[role="option"],li,div,span'))
        .filter(visibleElement)
        .map((node) => ({ node, text: elementText(node) }))
        .filter((item) => item.text && item.text.length < 240)
        .filter((item) => !/\u9009\u62e9\u7c7b\u76ee|\u9009\u62e9\u5206\u7c7b|\u641c\u7d22|\u5173\u95ed/.test(item.text));
      for (const term of terms) {
        const exact = options.find((item) => categoryOptionMatchesTerm(item.text, term));
        if (exact) return { option: exact.node.closest('.ant-select-item-option,[role="option"]') || exact.node, term, optionText: exact.text };
      }
    }
    return null;
  }

  function getVisibleCategoryModal() {
    return Array.from(document.querySelectorAll('.ant-modal,.ant-drawer,[role="dialog"]'))
      .filter((node) => visibleElement(node) && /选择|分类|类目|category/i.test(elementText(node)))
      .sort((a, b) => elementText(a).length - elementText(b).length)[0] || null;
  }

  function findCategoryModalItemByText(texts, columnIndex = null, rejectTexts = [], plan = null) {
    const modal = getVisibleCategoryModal();
    if (!modal) return null;
    const boxes = Array.from(modal.querySelectorAll('.categories-box,.category-box,.ant-tree,.ant-list,ul,div'))
      .filter(visibleElement)
      .map((box) => ({ box, rect: box.getBoundingClientRect(), text: elementText(box) }))
      .filter((item) => item.rect.width > 40 && item.rect.height > 40 && item.text.length < 6000)
      .sort((a, b) => a.rect.left - b.rect.left || a.rect.top - b.rect.top);
    const roots = columnIndex == null || !boxes[columnIndex] ? boxes.map((item) => item.box) : [boxes[columnIndex].box];
    const wanted = texts.map((text) => normalizeCategoryText(text));
    const rejected = rejectTexts.map((text) => normalizeCategoryText(text)).filter(Boolean);
    for (const root of roots) {
      const items = Array.from(root.querySelectorAll('.categories-item,.category-item,li,span,div'))
        .filter(visibleElement)
        .map((node) => ({ node, text: elementText(node), rect: node.getBoundingClientRect() }))
        .filter((item) => item.text && item.text.length < 260 && item.rect.width > 20 && item.rect.height > 8)
        .filter((item) => !/\u9009\u62e9\u7c7b\u76ee|\u9009\u62e9\u5206\u7c7b|\u641c\u7d22|\u5173\u95ed/.test(item.text))
        .filter((item) => (item.text.match(/>|\/|\u5bb6\u5c45\u7528\u54c1|Home\s*&\s*Garden/gi) || []).length <= 2)
        .filter((item) => {
          const text = normalizeCategoryText(item.text);
          return !rejected.some((value) => value && text.includes(value));
        })
        .sort((a, b) => a.text.length - b.text.length);
      const scored = items
        .map((item) => ({ ...item, normalized: normalizeCategoryText(item.text) }))
        .map((item) => scoreCategoryModalListCandidate(item, wanted, plan))
        .filter(Boolean)
        .sort((a, b) => b.score - a.score || a.wantedIndex - b.wantedIndex || a.text.length - b.text.length || a.rect.top - b.rect.top);
      const deepestMatches = scored.filter((item) => (
        !scored.some((other) => other.node !== item.node && item.node.contains(other.node))
      ));
      if (deepestMatches[0]) return deepestMatches[0].node;
      if (scored[0]) return scored[0].node;
    }
    return null;
  }

  async function clickCategoryModalItem(texts, columnIndex = null, plan = null) {
    const rejectTexts = Array.isArray(columnIndex) ? columnIndex : [];
    const actualColumnIndex = Array.isArray(columnIndex) ? null : columnIndex;
    const item = findCategoryModalItemByText(texts, actualColumnIndex, rejectTexts, plan);
    if (!item) return { ok: false, reason: `category item not found: ${texts.join(' / ')}` };
    clickElement(item);
    await sleep(700);
    return { ok: true, text: elementText(item) };
  }

  function scoreCategoryModalSearchCandidate(item, wanted, plan) {
    if (plan && categoryTextRejectedByModalPlan(item.text, plan)) return null;
    if (isStrictDxmCandidatePlan(plan)) {
      const strict = scoreStrictDxmCategoryCandidate(item.text, plan.leafTerms || []);
      if (!strict) return null;
      return {
        ...item,
        wantedIndex: strict.wantedIndex,
        matchKind: strict.kind,
        score: strict.score + Math.max(0, 320 - item.text.length) / 1800,
        familyScore: { familyId: '', blocked: false, bonus: 0, penalty: 0, reason: '' },
      };
    }
    if (plan && plan.exactDxmOnly) {
      const exact = scoreExactDxmCategoryCandidate(item.text, plan.leafTerms || []);
      if (!exact) return null;
      return {
        ...item,
        wantedIndex: exact.wantedIndex,
        matchKind: exact.kind,
        score: exact.score + Math.max(0, 320 - item.text.length) / 1800,
        familyScore: { familyId: '', blocked: false, bonus: 0, penalty: 0, reason: '' },
      };
    }
    const matched = wanted
      .map((value, index) => ({ index, match: scoreCategoryModalWantedMatch(item.normalized, value) }))
      .filter((entry) => entry.match && entry.match.safe)
      .sort((a, b) => b.match.score - a.match.score || a.index - b.index)[0];
    if (!matched) return null;
    const familyContext = plan
      ? `${plan.id || ''} ${(plan.topTerms || []).join(' ')} ${(plan.columnTerms || []).join(' ')} ${(plan.leafTerms || []).join(' ')}`
      : '';
    const familyScore = scoreCategoryFamilyCandidateText(item.text, familyContext);
    if (familyScore.blocked) return null;
    let score = matched.match.score - matched.index * 0.08;
    score += Math.max(0, 360 - item.text.length) / 1200;
    if (familyScore.bonus) score += familyScore.bonus;
    if (familyScore.penalty) score -= familyScore.penalty;
    if (isGenericCategoryModalText(item.normalized)) score -= 0.45;
    if (score < 0.65) return null;
    return {
      ...item,
      wantedIndex: matched.index,
      matchKind: matched.match.kind,
      score,
      familyScore,
    };
  }

  function findCategoryModalSearchResultByText(texts, rejectTexts = [], plan = null) {
    const modal = getVisibleCategoryModal();
    if (!modal) return null;
    const wanted = texts.map((text) => normalizeCategoryText(text)).filter(Boolean);
    const rejected = rejectTexts.map((text) => normalizeCategoryText(text)).filter(Boolean);
    const candidates = Array.from(modal.querySelectorAll('.search-result-item,[class*="search-result"]'))
      .filter(visibleElement)
      .map((node) => ({ node, text: elementText(node), rect: node.getBoundingClientRect() }))
      .filter((item) => item.text && item.text.length < 1200 && item.rect.width > 80 && item.rect.height > 12)
      .map((item) => ({ ...item, normalized: normalizeCategoryText(item.text) }))
      .filter((item) => !rejected.some((value) => value && item.normalized.includes(value)))
      .map((item) => scoreCategoryModalSearchCandidate(item, wanted, plan))
      .filter(Boolean);
    candidates.sort((a, b) => b.score - a.score || a.wantedIndex - b.wantedIndex || a.text.length - b.text.length || a.rect.top - b.rect.top);
    return candidates[0] && candidates[0].node;
  }

  async function clickCategoryModalSearchResult(texts, rejectTexts = [], plan = null) {
    const item = findCategoryModalSearchResultByText(texts, rejectTexts, plan);
    if (!item) return { ok: false, reason: `category search result not found: ${texts.join(' / ')}` };
    clickElement(item);
    await sleep(900);
    return { ok: true, text: elementText(item) };
  }

  function getVisibleCategoryModalInputs() {
    const modal = getVisibleCategoryModal();
    if (!modal) return [];
    return Array.from(modal.querySelectorAll('input[type="text"],input[type="search"]'))
      .filter(visibleElement)
      .map((node) => ({ node, rect: node.getBoundingClientRect(), placeholder: String(node.getAttribute('placeholder') || '') }))
      .sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left);
  }

  async function fillCategoryModalInput(input, value, options = {}) {
    if (!input) return { ok: false, reason: 'input not found' };
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    if (descriptor && descriptor.set) descriptor.set.call(input, String(value));
    else input.value = String(value);
    if (typeof input.focus === 'function') input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));
    input.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: String(value) }));
    input.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: String(value) }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    ['keydown', 'keypress', 'keyup'].forEach((type) => {
      input.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
    });
    if (options.clickSearch) {
      const modal = getVisibleCategoryModal();
      const button = modal && Array.from(modal.querySelectorAll('button,a,span'))
        .filter(visibleElement)
        .find((node) => elementText(node) === '\u641c\u7d22');
      if (button) {
        const target = button.closest('button,a') || button;
        callReactHandler(target, 'onMouseDown', target);
        callReactHandler(target, 'onClick', target);
        clickElement(target);
      }
    }
    await sleep(options.waitMs || 900);
    return { ok: true, value };
  }

  async function searchCategoryModalTop(term) {
    const inputs = getVisibleCategoryModalInputs();
    const topInput = inputs[0] && inputs[0].node;
    if (!topInput) return { ok: false, reason: 'top category search input not found', term };
    return fillCategoryModalInput(topInput, term, { clickSearch: true, waitMs: 1100 });
  }

  async function searchCategoryModalColumns(terms) {
    const inputs = getVisibleCategoryModalInputs().slice(1);
    const results = [];
    for (let index = 0; index < Math.min(inputs.length, terms.length); index += 1) {
      const term = terms[index];
      if (!term) continue;
      const result = await fillCategoryModalInput(inputs[index].node, term, { waitMs: 700 });
      results.push({ index, term, ...result });
    }
    return results;
  }

  async function selectCategoryByModalSearchPlan(plan) {
    if (!plan) return { ok: false, skipped: true, reason: 'no modal search plan' };
    const attempts = [];
    for (const topTerm of plan.topTerms || []) {
      attempts.push({ step: 'top-search', topTerm, result: await searchCategoryModalTop(topTerm) });
      let leaf = await clickCategoryModalSearchResult(plan.leafTerms || [], plan.rejectTerms || [], plan);
      attempts.push({ step: 'search-result-leaf-click', topTerm, ...leaf });
      if (leaf.ok) {
        const confirm = await finalizeCategorySelectionAfterVisibleWrite(plan);
        await sleep(500);
        const after = getProductCategorySelectedText();
        const success = !isBlankSelectionText(after.selectedText) && categoryTextMatchesModalPlan(after.selectedText, plan);
          return {
            ok: success,
            changed: success,
            selectedText: after.selectedText,
            mode: 'modal-search-plan-search-result',
            reason: success ? '' : ((confirm && confirm.reason) || 'dxm_visible_category_not_found'),
            planId: plan.id,
            topTerm,
            leafText: leaf.text,
            confirm,
          attempts,
        };
      }
      if (plan.exactDxmOnly) {
        attempts.push({
          step: 'exact-dxm-only-stop',
          topTerm,
          ok: false,
          reason: 'dxm_exact_category_not_found',
        });
        continue;
      }
      if (plan.source !== 'asin-aliexpress-evidence-store') {
        leaf = await clickCategoryModalItem(plan.leafTerms || [], plan.rejectTerms || [], plan);
        attempts.push({ step: 'direct-leaf-click', topTerm, ...leaf });
        if (leaf.ok) {
          const confirm = await finalizeCategorySelectionAfterVisibleWrite(plan);
          await sleep(500);
          const after = getProductCategorySelectedText();
          const success = !isBlankSelectionText(after.selectedText) && categoryTextMatchesModalPlan(after.selectedText, plan);
          return {
            ok: success,
            changed: success,
            selectedText: after.selectedText,
            mode: 'modal-search-plan-direct-leaf',
            reason: success ? '' : ((confirm && confirm.reason) || 'dxm_visible_category_not_found'),
            planId: plan.id,
            topTerm,
            leafText: leaf.text,
            confirm,
            attempts,
          };
        }
      } else {
        attempts.push({
          step: 'direct-leaf-click',
          topTerm,
          ok: false,
          skipped: true,
          reason: 'asin evidence category requires an exact visible leaf; generic direct click disabled',
        });
      }
      const topMatch = await clickCategoryModalItem(plan.columnTerms || [topTerm], null);
      if (topMatch.ok) attempts.push({ step: 'top-match-click', ...topMatch });
      await searchCategoryModalColumns(plan.columnTerms || []);
      leaf = await clickCategoryModalItem(plan.leafTerms || [], plan.rejectTerms || [], plan);
      attempts.push({ step: 'leaf-click', topTerm, ...leaf });
      if (leaf.ok) {
        const confirm = await finalizeCategorySelectionAfterVisibleWrite(plan);
        await sleep(500);
        const after = getProductCategorySelectedText();
        const success = !isBlankSelectionText(after.selectedText) && categoryTextMatchesModalPlan(after.selectedText, plan);
        return {
          ok: success,
          changed: success,
          selectedText: after.selectedText,
          mode: 'modal-search-plan',
          reason: success ? '' : ((confirm && confirm.reason) || 'dxm_visible_category_not_found'),
          planId: plan.id,
          topTerm,
          leafText: leaf.text,
          confirm,
          attempts,
        };
      }
    }
    return {
      ok: false,
      changed: false,
      mode: isStrictDxmCandidatePlan(plan) ? 'strict-dxm-category-search' : (plan.exactDxmOnly ? 'exact-dxm-category-search' : 'modal-search-plan'),
      planId: plan.id,
      attempts,
      reason: isStrictDxmCandidatePlan(plan) ? 'dxm_strict_category_not_found' : (plan.exactDxmOnly ? 'dxm_exact_category_not_found' : 'leaf not selected'),
    };
  }

  async function clickVisibleCategoryCommitButton() {
    const modal = getVisibleCategoryModal();
    if (!modal) return { clicked: false, reason: 'category_modal_not_visible' };
    const candidates = Array.from(modal.querySelectorAll('button,a,span,.ant-btn'))
      .filter(visibleElement)
      .map((node) => {
        const clickable = node.closest('button,a') || node;
        return {
          node: clickable,
          text: elementText(node),
          className: String(node.className || ''),
          rect: clickable.getBoundingClientRect(),
        };
      })
      .filter((item) => /^\s*(\u9009\u62e9|\u786e\u5b9a|\u786e\u8ba4)\s*$/.test(item.text) || /ant-btn-primary/.test(item.className))
      .filter((item) => !/\u5173\u95ed|\u53d6\u6d88|close|cancel/i.test(`${item.text} ${item.className}`))
      .sort((a, b) => b.rect.top - a.rect.top || b.rect.left - a.rect.left);
    const target = candidates[0];
    if (!target) return { clicked: false, reason: 'category_commit_button_not_found' };
    clickElement(target.node);
    await sleep(900);
    return {
      clicked: true,
      text: target.text,
      closed: !getVisibleCategoryModal(),
      mode: 'category-modal-commit-button',
    };
  }

  async function dismissVisibleCategoryModal(allowDomFallback = false) {
    const modal = getVisibleCategoryModal();
    if (!modal) return { closed: true, mode: 'not-open' };
    const tryButtons = (patterns) => Array.from(modal.querySelectorAll('button,a,span,.ant-modal-close'))
      .filter(visibleElement)
      .filter((node) => patterns.some((pattern) => pattern.test(`${elementText(node)} ${String(node.className || '')}`)))
      .sort((a, b) => {
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        return br.top - ar.top || br.left - ar.left;
      });
    for (const node of tryButtons([/^\s*(\u9009\u62e9|\u786e\u5b9a)\s*$/, /ant-btn-primary/])) {
      clickElement(node.closest('button,a') || node);
      await sleep(700);
      if (!getVisibleCategoryModal()) return { closed: true, mode: 'confirm-button' };
    }
    const globalConfirm = Array.from(document.querySelectorAll('button,a,.ant-btn,span'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node))
      .filter((node) => /^\s*(\u9009\u62e9|\u786e\u5b9a)\s*$/.test(elementText(node)))
      .filter((node) => !/\u5173\u95ed|\u53d6\u6d88|close/i.test(`${elementText(node)} ${String(node.className || '')}`))
      .sort((a, b) => {
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        return br.top - ar.top || br.left - ar.left;
      })[0];
    if (globalConfirm) {
      clickElement(globalConfirm.closest('button,a') || globalConfirm);
      await sleep(900);
      if (!getVisibleCategoryModal()) return { closed: true, mode: 'global-confirm-button' };
    }
    for (const node of tryButtons([/^\s*(\u5173\u95ed|\u53d6\u6d88|×|x)\s*$/i, /ant-modal-close|close/i])) {
      clickElement(node.closest('button,a') || node);
      await sleep(700);
      if (!getVisibleCategoryModal()) return { closed: true, mode: 'close-button' };
    }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
    await sleep(500);
    if (!getVisibleCategoryModal()) return { closed: true, mode: 'escape' };
    if (allowDomFallback) {
      Array.from(document.querySelectorAll('.ant-modal-root,.ant-modal-wrap,.ant-modal-mask,.ant-modal'))
        .filter((node) => elementText(node).includes('\u9009\u62e9\u7c7b\u76ee') || elementText(node).includes('\u9009\u62e9\u5206\u7c7b'))
        .forEach((node) => {
          node.style.display = 'none';
          node.style.pointerEvents = 'none';
          node.setAttribute('data-dxm-category-modal-hidden', '1');
        });
      await sleep(200);
      if (!getVisibleCategoryModal()) return { closed: true, mode: 'dom-fallback' };
    }
    return { closed: false, mode: 'failed' };
  }

  async function waitForCategoryModalClosed(timeoutMs = 2200) {
    const start = Date.now();
    while (getVisibleCategoryModal() && Date.now() - start < timeoutMs) {
      await sleep(160);
    }
    return !getVisibleCategoryModal();
  }

  async function hideCommittedCategoryModalAfterWrite() {
    const modal = getVisibleCategoryModal();
    if (!modal) return { closed: true, mode: 'not-open-after-write' };
    const roots = new Set([modal]);
    let node = modal;
    while (node && node !== document.body && node !== document.documentElement) {
      if (
        node.classList
        && (
          node.classList.contains('ant-modal-root')
          || node.classList.contains('ant-modal-wrap')
          || node.classList.contains('ant-modal')
          || node.classList.contains('ant-drawer')
        )
      ) {
        roots.add(node);
      }
      node = node.parentElement;
    }
    Array.from(document.querySelectorAll('.ant-modal-root,.ant-modal-wrap,.ant-modal-mask,.ant-modal,.ant-drawer,.ant-drawer-mask,.ant-drawer-content-wrapper'))
      .filter((item) => item === modal || item.contains(modal) || modal.contains(item) || /选择类目|选择分类|category/i.test(elementText(item)))
      .forEach((item) => roots.add(item));
    roots.forEach((item) => {
      item.style.display = 'none';
      item.style.pointerEvents = 'none';
      item.setAttribute('data-dxm-category-modal-hidden', '1');
    });
    document.body.classList.remove('ant-scrolling-effect');
    document.body.style.overflow = '';
    await sleep(120);
    return {
      closed: !getVisibleCategoryModal(),
      mode: 'dom-fallback-after-category-write',
      hiddenNodes: roots.size,
    };
  }

  function categorySelectionMatchesExpectedPlan(selectedText, plan = null) {
    if (isBlankSelectionText(selectedText)) return false;
    return !plan || categoryTextMatchesModalPlan(selectedText, plan);
  }

  function buildCategoryCommitFailure(before, after, commit, plan = null) {
    return {
      closed: !getVisibleCategoryModal(),
      mode: 'dxm_category_commit_failed',
      reason: 'dxm_category_commit_failed',
      selectedText: (after && after.selectedText) || (before && before.selectedText) || '',
      expectedCategoryPath: plan && plan.expectedCategoryPath ? plan.expectedCategoryPath : '',
      expectedLeafTerms: plan && Array.isArray(plan.leafTerms) ? plan.leafTerms : [],
      commit,
      modalStillVisible: Boolean(getVisibleCategoryModal()),
    };
  }

  function isCategoryCommitFailed(result) {
    return Boolean(result && result.reason === 'dxm_category_commit_failed');
  }

  async function finalizeCategorySelectionAfterVisibleWrite(plan = null) {
    let before = getProductCategorySelectedText();
    if (!categorySelectionMatchesExpectedPlan(before.selectedText, plan)) {
      if (getVisibleCategoryModal()) {
        const commit = await clickVisibleCategoryCommitButton();
        await sleep(500);
        const afterCommit = getProductCategorySelectedText();
        if (categorySelectionMatchesExpectedPlan(afterCommit.selectedText, plan)) {
          if (getVisibleCategoryModal()) {
            const hidden = await hideCommittedCategoryModalAfterWrite();
            return {
              ...hidden,
              mode: hidden.mode || 'category-commit-button',
              selectedText: afterCommit.selectedText,
              commit,
              modalStillVisible: Boolean(getVisibleCategoryModal()),
            };
          }
          return {
            closed: true,
            mode: 'category-commit-button',
            selectedText: afterCommit.selectedText,
            commit,
            modalStillVisible: false,
          };
        }
        return buildCategoryCommitFailure(before, afterCommit, commit, plan);
      }
      return buildCategoryCommitFailure(before, before, null, plan);
    }
    if (getVisibleCategoryModal()) {
      const hidden = await hideCommittedCategoryModalAfterWrite();
      const afterHidden = getProductCategorySelectedText();
      if (hidden.closed && categorySelectionMatchesExpectedPlan(afterHidden.selectedText || before.selectedText, plan)) {
        return {
          ...hidden,
          selectedText: afterHidden.selectedText || before.selectedText,
          modalStillVisible: Boolean(getVisibleCategoryModal()),
        };
      }
      if (!categorySelectionMatchesExpectedPlan(afterHidden.selectedText || before.selectedText, plan)) {
        return buildCategoryCommitFailure(before, afterHidden, hidden, plan);
      }
    }
    let dismiss = await dismissVisibleCategoryModal(false);
    let closed = dismiss.closed || await waitForCategoryModalClosed(1200);
    if (!closed) {
      dismiss = await dismissVisibleCategoryModal(true);
      closed = dismiss.closed || await waitForCategoryModalClosed(800);
    }
    const after = getProductCategorySelectedText();
    if (!categorySelectionMatchesExpectedPlan(after.selectedText || before.selectedText, plan)) {
      return buildCategoryCommitFailure(before, after, dismiss, plan);
    }
    return {
      ...dismiss,
      closed,
      selectedText: after.selectedText || before.selectedText,
      modalStillVisible: Boolean(getVisibleCategoryModal()),
    };
  }

  async function selectFastDrawerStorageCategory() {
    const title = getCurrentEditTitleText();
    if (!isDrawerStorageProductText(title)) return { skipped: true, reason: 'not drawer storage product' };
    const current = getProductCategorySelectedText();
    if (current.selectedText && isGoodDrawerStorageCategory(current.selectedText)) {
      return { ok: true, changed: false, selectedText: current.selectedText, mode: 'already-good-fast-path' };
    }
    const button = Array.from(document.querySelectorAll('button,a,.ant-btn'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node))
      .find((node) => elementText(node).includes('\u9009\u62e9\u5206\u7c7b') || elementText(node).includes('\u9009\u62e9\u7c7b\u76ee'));
    if (!button) return { ok: false, reason: 'category choose button not found' };
    clickElement(button);
    await sleep(900);

    const searchInput = Array.from(document.querySelectorAll('.ant-modal input[type="text"],.ant-modal input[type="search"],input[type="text"],input[type="search"]'))
      .filter((node) => visibleElement(node) && !node.closest(`#${PANEL_ID}`))
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
    if (searchInput) setInputValue(searchInput, '');

    const top = await clickCategoryModalItem(['\u5bb6\u5c45\u7528\u54c1', 'Home & Garden'], 0);
    if (!top.ok) return top;
    const mid = await clickCategoryModalItem(['\u5bb6\u7528\u50a8\u5b58\u6536\u85cf\u7528\u5177', 'Home Storage & Organization'], 1);
    if (!mid.ok) return mid;
    const leaf =
      (await clickCategoryModalItem(['\u5bb6\u7528\u529e\u516c\u6536\u7eb3\u7528\u54c1', 'Home Office Storage'], 2)).ok
        ? { ok: true, text: '\u5bb6\u7528\u529e\u516c\u6536\u7eb3\u7528\u54c1(Home Office Storage)' }
        : await clickCategoryModalItem(['\u6536\u7eb3\u76d2\u548c\u6536\u7eb3\u7bb1', 'Storage Boxes & Bins'], 2);
    if (!leaf.ok) return leaf;

    const confirmButton = Array.from(document.querySelectorAll('.ant-modal button,.ant-drawer button,button,a,.ant-btn'))
      .filter((node) => visibleElement(node) && !node.closest(`#${PANEL_ID}`))
      .find((node) => /\u9009\u62e9|\u786e\u5b9a|\u4fdd\u5b58/.test(elementText(node)) && !/\u53d6\u6d88|\u5173\u95ed/.test(elementText(node)));
    if (confirmButton) {
      clickElement(confirmButton);
      await sleep(1200);
    }
    const after = getProductCategorySelectedText();
    const dismiss = !isBlankSelectionText(after.selectedText) ? await dismissVisibleCategoryModal(true) : null;
    return {
      ok: !isBlankSelectionText(after.selectedText) && isGoodDrawerStorageCategory(after.selectedText),
      changed: true,
      selectedText: after.selectedText,
      mode: 'fast-drawer-storage-path',
      leaf: leaf.text,
      dismiss,
    };
  }

  async function selectVisibleProductCategory() {
    const current = getProductCategorySelectedText();
    if (!current.container) return { changed: false, ok: false, reason: 'product category container not found' };
    const title = getCurrentEditTitleText();
    const modalPlan = buildCategoryModalSearchPlan(title);
    const selectedMatchesVerifiedPlan = modalPlan && categoryTextMatchesModalPlan(current.selectedText, modalPlan);
    if (
      !isBlankSelectionText(current.selectedText)
      && !isWrongDrawerStorageCategory(current.selectedText)
      && (selectedMatchesVerifiedPlan || (!REQUIRE_ALIEXPRESS_CATEGORY_EVIDENCE && !modalPlan))
    ) {
      return {
        changed: false,
        ok: true,
        selectedText: current.selectedText,
        mode: 'already-selected',
        categoryEvidence: modalPlan ? modalPlan.categoryEvidence : null,
      };
    }
    if (!modalPlan && REQUIRE_ALIEXPRESS_CATEGORY_EVIDENCE) {
      const categoryEvidence = buildMissingCategoryEvidence(title, current.selectedText);
      return {
        changed: false,
        ok: false,
        reason: 'AliExpress category evidence is missing; run category verification before Dianxiaomi category search',
        selectedText: current.selectedText,
        mode: 'aliexpress-evidence-required',
        failureReason: 'category_evidence_missing',
        legalSkipReason: 'category_evidence_missing',
        categoryEvidence,
      };
    }

    const terms = buildVisibleCategoryTerms();
    const opener = Array.from(current.container.querySelectorAll('.ant-select-selector,.ant-select,input[role="combobox"],input[type="search"],input[type="text"],button'))
      .filter(visibleElement)[0];
    if (!opener) return { changed: false, ok: false, reason: 'product category selector not found', terms };

    if (modalPlan) {
      const categoryButton = Array.from(current.container.querySelectorAll('button,a,.ant-btn'))
        .filter(visibleElement)
        .find((node) => elementText(node).includes('\u9009\u62e9\u5206\u7c7b'));
      clickElement(categoryButton || opener);
      await sleep(900);
      const planned = await selectCategoryByModalSearchPlan(modalPlan);
      if (planned.ok) {
        return {
          ...planned,
          categoryEvidence: modalPlan.categoryEvidence,
        };
      }
      const dismiss = await dismissVisibleCategoryModal(false);
      const after = getProductCategorySelectedText();
      const evidenceClear = modalPlan.categoryEvidence && modalPlan.categoryEvidence.status === CATEGORY_EVIDENCE_STATUS.CLEAR;
      const autoMappingFailureReason = modalPlan.dxmAutoMappingRequired
        ? (planned.reason === 'dxm_exact_category_not_found' ? 'dxm_exact_category_not_found' : 'aliexpress_category_confirmed_but_dxm_mapping_missing')
        : 'dxm_visible_category_not_found';
      return {
        ...planned,
        changed: Boolean(planned.changed),
        ok: false,
        selectedText: after.selectedText || planned.selectedText || current.selectedText,
        mode: planned.mode || 'modal-search-plan',
        dismiss,
        genericFallbackDisabled: true,
        categoryEvidence: modalPlan.categoryEvidence,
        failureReason: evidenceClear ? autoMappingFailureReason : 'category_evidence_missing',
        legalSkipReason: evidenceClear ? autoMappingFailureReason : 'category_evidence_missing',
        reason: planned.reason || 'AliExpress category is confirmed, but Dianxiaomi exact category was not found',
      };
    }

    if (isDrawerStorageProductText(title)) {
      const fast = await selectFastDrawerStorageCategory();
      if (fast.ok) return fast;
    }

    for (const term of terms) {
      clickElement(opener);
      await sleep(350);
      const searchInput = Array.from(document.querySelectorAll('.ant-select-dropdown input[role="combobox"],.ant-select-dropdown input[type="search"],input[role="combobox"],input[type="search"]'))
        .filter((node) => visibleElement(node) && !node.closest(`#${PANEL_ID}`))[0];
      if (searchInput) {
        setInputValue(searchInput, term);
        pressKey(searchInput, 'Enter');
        await sleep(650);
      }
      const matched = findVisibleCategoryOptionForTerms([term]);
      if (!matched) continue;
      forceSelectOption(matched.option);
      await sleep(700);
      const after = getProductCategorySelectedText();
      if (!isBlankSelectionText(after.selectedText)) {
        const dismiss = await dismissVisibleCategoryModal(true);
        const ok = !modalPlan || categoryTextMatchesModalPlan(after.selectedText, modalPlan);
        return {
          changed: true,
          ok,
          selectedText: after.selectedText,
          matchedTerm: matched.term,
          optionText: matched.optionText,
          mode: 'dropdown-search',
          dismiss,
        };
      }
    }

    const categoryButton = Array.from(current.container.querySelectorAll('button,a,.ant-btn'))
      .filter(visibleElement)
      .find((node) => elementText(node).includes('\u9009\u62e9\u5206\u7c7b'));
    if (categoryButton) {
      clickElement(categoryButton);
      await sleep(900);
      for (const term of terms) {
        const searchInput = Array.from(document.querySelectorAll('.ant-modal input[type="text"],.ant-modal input[type="search"],.ant-drawer input[type="text"],.ant-drawer input[type="search"],input[type="text"],input[type="search"]'))
          .filter((node) => visibleElement(node) && !node.closest(`#${PANEL_ID}`))
          .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
        if (searchInput) {
          setInputValue(searchInput, term);
          pressKey(searchInput, 'Enter');
          await sleep(700);
        }
        const matched = findVisibleCategoryOptionForTerms([term]);
        if (!matched) continue;
        forceSelectOption(matched.option);
        clickElement(matched.option);
        await sleep(500);
        const confirmButton = Array.from(document.querySelectorAll('.ant-modal button,.ant-drawer button,button,a,.ant-btn'))
          .filter((node) => visibleElement(node) && !node.closest(`#${PANEL_ID}`))
          .find((node) => /\u786e\u5b9a|\u4fdd\u5b58|\u9009\u62e9/.test(elementText(node)) && !/\u53d6\u6d88/.test(elementText(node)));
        if (confirmButton) {
          clickElement(confirmButton);
          await sleep(800);
        }
        const after = getProductCategorySelectedText();
        if (!isBlankSelectionText(after.selectedText)) {
          const dismiss = await dismissVisibleCategoryModal(true);
          const ok = !modalPlan || categoryTextMatchesModalPlan(after.selectedText, modalPlan);
          return {
            changed: true,
            ok,
            selectedText: after.selectedText,
            matchedTerm: matched.term,
            optionText: matched.optionText,
            mode: 'category-button-modal',
            dismiss,
          };
        }
      }
    }

    return { changed: false, ok: false, reason: 'no high-confidence category option selected', terms };
  }

  const FIXED_REQUIRED_ATTRIBUTE_VALUES = Object.freeze({
    brand: Object.freeze(['NONE(AE\u5b58\u91cf)*******(None)']),
    highConcernedChemical: Object.freeze(['\u5929\u7136\u672a\u5904\u7406(None)']),
    origin: Object.freeze(['\u7f8e\u56fd(Origin)(US(Origin))']),
  });

  const VISIBLE_REQUIRED_ATTRIBUTE_RULES = [
    {
      id: 'brand',
      label: /\u54c1\u724c|brand/i,
      exclude: /\u54c1\u724c\u5236\u9020\u5546|\u5236\u9020\u5546|\u6b27\u76df|\u571f\u8033\u5176|manufacturer/i,
      values: FIXED_REQUIRED_ATTRIBUTE_VALUES.brand,
    },
    {
      id: 'high_concerned_chemical',
      label: /\u9ad8\u5173\u6ce8\u5316\u5b66\u54c1|high[-\s]?concerned chemical/i,
      values: FIXED_REQUIRED_ATTRIBUTE_VALUES.highConcernedChemical,
    },
    {
      id: 'function',
      label: /\u529f\u80fd|function/i,
      values: ['\u5176\u4ed6(Other)', 'Other', '\u5176\u4ed6'],
    },
    {
      id: 'feature',
      label: /\u7279\u6027|\u7279\u70b9|feature/i,
      values: ['\u5176\u4ed6(Other)', 'Other', '\u5176\u4ed6'],
    },
    {
      id: 'use',
      label: /\u7528\u9014|^use$|\(use\)/i,
      values: ['Other', '\u5176\u4ed6', 'Home', 'Household', 'Office', 'Storage'],
    },
    {
      id: 'origin',
      label: /\u4ea7\u5730|\u56fd\u5bb6\u6216\u5730\u533a|origin/i,
      values: FIXED_REQUIRED_ATTRIBUTE_VALUES.origin,
    },
    {
      id: 'product_application_scenarios',
      label: /\u4ea7\u54c1\u9002\u7528\u573a\u666f|product application scenarios?/i,
      values: ['\u53a8\u623f(Kitchen)', 'Kitchen', '\u53a8\u623f', '\u9910\u684c\u7528(Dining table)', 'Dining table', '\u9910\u684c\u7528'],
    },
    {
      id: 'theme',
      label: /\u4e3b\u9898|theme/i,
      values: ['\u5176\u4ed6(Other)', 'Other', '\u5176\u4ed6'],
    },
  ];

  function getVisibleMaterialCandidateValues() {
    const product = getProductFromEdit(state.editData) || {};
    const titleInput = findProductTitleInput();
    const payload = {
      subject: firstNonEmpty(titleInput ? getInputText(titleInput) : '', product.subject, product.title, product.productTitle, ''),
    };
    const sourceText = normalizeCategoryText([
      payload.subject,
      product.subject,
      product.title,
      product.productTitle,
      product.description,
      product.detail,
    ].filter(Boolean).join(' '));
    if (/\b(?:sink|drain)\s+(?:strainer|filter|catcher|stopper)|\bkitchen\s+sink|\u6c34\u69fd|\u6ee4\u7f51/.test(sourceText)) {
      return ['\u4e0d\u9508\u94a2(Stainless Steel)', 'Stainless Steel', '\u4e0d\u9508\u94a2', 'Metal', '\u91d1\u5c5e', 'Steel', '\u94a2'];
    }
    if (/silicone|\u7845\u80f6|\u7845\u6a61\u80f6/.test(sourceText)) {
      return ['\u7845\u80f6(Silicone)', 'Silicone', '\u7845\u80f6', 'Silicone Rubber', '\u7845\u6a61\u80f6', 'Rubber', '\u6a61\u80f6'];
    }
    const candidates = inferMaterialCandidates(payload, product);
    const values = [];
    for (const candidate of candidates) {
      if (/pet/i.test(candidate)) values.push('PET', '\u5851\u6599(Plastic)', 'Plastic', '\u5851\u6599');
      else if (/acrylic/i.test(candidate)) values.push('Acrylic', '\u4e9a\u514b\u529b', '\u5851\u6599(Plastic)', 'Plastic', '\u5851\u6599');
      else if (/plastic|abs/i.test(candidate)) values.push('\u5851\u6599(Plastic)', 'Plastic', '\u5851\u6599', 'ABS');
      else if (/silicone/i.test(candidate)) values.push('Silicone', '\u7845\u80f6');
      else if (/rubber/i.test(candidate)) values.push('Rubber', '\u6a61\u80f6');
      else if (/metal/i.test(candidate)) values.push('Metal', '\u91d1\u5c5e');
      else if (/wood/i.test(candidate)) values.push('Wood', '\u6728');
      else if (/fiberglass/i.test(candidate)) values.push('Fiberglass', 'Glass Fiber', '\u73bb\u7483\u7ea4\u7ef4');
    }
    values.push('\u7845\u80f6(Silicone)', 'Silicone', '\u7845\u80f6', 'Silicone Rubber', '\u7845\u6a61\u80f6', 'PET', '\u5851\u6599(Plastic)', 'Plastic', '\u5851\u6599');
    values.push('\u5176\u4ed6 \uff08\u81ea\u884c\u586b\u5199\uff09(Other)', '\u5176\u4ed6(\u81ea\u884c\u586b\u5199)(Other)', '\u5176\u4ed6(Other)', 'Other', '\u5176\u4ed6');
    return Array.from(new Set(values));
  }

  function getVisibleApplicationScenarioCandidateValues() {
    const product = getProductFromEdit(state.editData) || {};
    const titleInput = findProductTitleInput();
    const sourceText = normalizeCategoryText([
      titleInput ? getInputText(titleInput) : '',
      product.subject,
      product.title,
      product.productTitle,
      product.description,
      product.detail,
      getProductCategorySelectedText().selectedText,
    ].filter(Boolean).join(' '));
    const values = [];
    if (/kitchen|trivet|hot\s*pad|placemat|table|countertop|dish|sink|\u53a8\u623f|\u9910\u684c|\u9910\u57ab|\u9694\u70ed|\u9505\u57ab/.test(sourceText)) {
      values.push('\u53a8\u623f(Kitchen)', 'Kitchen', '\u53a8\u623f', '\u9910\u684c\u7528(Dining table)', 'Dining table', '\u9910\u684c\u7528');
    }
    values.push('\u53a8\u623f(Kitchen)', 'Kitchen', '\u53a8\u623f', '\u5bb6\u5c45(Home)', 'Home', '\u5bb6\u5c45');
    return Array.from(new Set(values));
  }

  function getVisibleThemeCandidateValues() {
    return ['\u5176\u4ed6(Other)', 'Other', '\u5176\u4ed6'];
  }

  function getGenericOtherCandidateValues() {
    return ['\u5176\u4ed6(Other)', 'Other', '\u5176\u4ed6', '\u5176\u4ed6(others)'];
  }

  function getVisibleFrameMaterialCandidateValues() {
    return getGenericOtherCandidateValues();
  }

  function getVisibleUseCandidateValues() {
    return getGenericOtherCandidateValues().concat(['杂货(Sundries)', 'Sundries', '杂货']);
  }

  function getVisibleFunctionCandidateValues() {
    return getGenericOtherCandidateValues();
  }

  function getVisibleFeatureCandidateValues(labelText = '') {
    const product = getProductFromEdit(state.editData) || {};
    const titleInput = findProductTitleInput();
    const sourceText = normalizeCategoryText([
      titleInput ? getInputText(titleInput) : '',
      product.subject,
      product.title,
      product.productTitle,
      product.description,
      product.detail,
      labelText,
      elementText(getEditFormScope()).slice(0, 1200),
    ].filter(Boolean).join(' '));
    const values = [];
    if (/bpa[-\s]?free|\u65e0\s*bpa|\u4e0d\u542b\s*bpa/i.test(sourceText)) {
      values.push(
        '\u65e0BPA\u5851\u6599(Bpa-free plastic)',
        'Bpa-free plastic',
        '\u65e0BPA\u5851\u6599',
        'BPA free',
        'BPA-free'
      );
    }
    if (/waterproof|\u9632\u6c34/.test(sourceText)) {
      values.push('\u9632\u6c34(Waterproof)', 'Waterproof', '\u9632\u6c34');
    }
    if (/reusable|\u53ef\u91cd\u590d|\u53cd\u590d\u4f7f\u7528/.test(sourceText)) {
      values.push('\u53ef\u91cd\u590d\u4f7f\u7528(Reusable)', 'Reusable', '\u53ef\u91cd\u590d\u4f7f\u7528');
    }
    if (/multi\s*use|multiple\s+uses|multipurpose|multi-purpose|\u591a\u7528|\u591a\u7528\u9014|\u6536\u7eb3|\u6574\u7406|organizer|storage|kitchen|bathroom|vanity|home|household/.test(sourceText)) {
      values.push(
        '\u591a\u7528\u9014(Multiple Uses)',
        'Multiple Uses'
      );
    }
    if (/adjustable|\u53ef\u8c03|\u53ef\u8c03\u8282|resize|extendable|expandable/.test(sourceText)) {
      values.push('\u53ef\u8c03\u8282\u5c3a\u5bf8(Adjustable Size)', 'Adjustable Size', '\u53ef\u8c03\u8282\u5c3a\u5bf8');
    }
    values.push('\u5176\u4ed6(Other)', 'Other', '\u5176\u4ed6');
    return Array.from(new Set(values));
  }

  function findVisibleAttributeContainers() {
    const scope = getEditFormScope();
    return Array.from(scope.querySelectorAll('.ant-form-item,.form-group,.row,div,td,tr'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node))
      .filter((node) => node.querySelector('.ant-select,input[role="combobox"],input[type="search"],input[type="text"],input[type="checkbox"],input[type="radio"]'))
      .map((node) => ({ node, text: elementText(node), rect: node.getBoundingClientRect() }))
      .filter((item) => item.text && item.text.length < 700)
      .sort((a, b) => a.text.length - b.text.length || a.rect.top - b.rect.top);
  }

  function getAttributeContainerLabelText(node) {
    const labelNode = node && node.querySelector('.attr-label,.label-wrapper,.ant-form-item-label,label');
    return elementText(labelNode).replace(/\s+/g, ' ').trim();
  }

  function hasVisibleRequiredAttributeMarker(node) {
    if (!node || node.closest(`#${PANEL_ID}`) || !visibleElement(node)) return false;
    const labelText = getAttributeContainerLabelText(node);
    const text = elementText(node);
    return Boolean(
      node.querySelector('.attr-label.required,.ant-form-item-required')
      || (labelText && /\*/.test(labelText))
      || /^\s*\*/.test(text.slice(0, 160))
    );
  }

  function nodeOverlapsAnyUsed(node, usedNodes) {
    for (const used of usedNodes) {
      if (node === used || node.contains(used) || used.contains(node)) return true;
    }
    return false;
  }

  function findBestAttributeContainerForRule(containers, rule, usedNodes, options = {}) {
    const matches = containers
      .filter((candidate) => rule.label.test(candidate.text) && !(rule.exclude && rule.exclude.test(candidate.text)))
      .filter((candidate) => !options.requireRequiredStar || hasVisibleRequiredAttributeMarker(candidate.node))
      .filter((candidate) => {
        if (!options.requireRequiredStar) return true;
        const labelText = getAttributeContainerLabelText(candidate.node);
        const currentFieldText = labelText || candidate.text.slice(0, 180);
        return rule.label.test(currentFieldText) && !(rule.exclude && rule.exclude.test(currentFieldText));
      })
      .filter((candidate) => !nodeOverlapsAnyUsed(candidate.node, usedNodes))
      .map((candidate) => {
        const labelBonus = candidate.node.matches('.ant-form-item,.form-group,.row,tr') ? 0 : 2000;
        const requiredBonus = /\*/.test(candidate.text) ? 0 : 200;
        const multiFieldPenalty = (candidate.text.match(/\*\s*(品牌|高关注化学品|产地|材质|Brand|Material|Origin)/gi) || []).length > 1 ? 20000 : 0;
        return {
          ...candidate,
          score: labelBonus + requiredBonus + multiFieldPenalty + candidate.text.length + Math.round(candidate.rect.height),
        };
      })
      .sort((a, b) => a.score - b.score || a.rect.top - b.rect.top);
    return matches[0] || null;
  }

  function getDirectRequiredAttributeClassName(ruleId) {
    const classByRule = {
      frame_material: 'smtDynamicAttr906',
      function: 'smtDynamicAttr43',
      use: 'smtDynamicAttr521',
      high_concerned_chemical: 'smtDynamicAttr400000603',
      origin: 'smtDynamicAttr219',
      material: 'smtDynamicAttr10',
    };
    return classByRule[ruleId] || '';
  }

  function findDirectRequiredAttributeContainer(ruleId, options = {}) {
    const className = getDirectRequiredAttributeClassName(ruleId);
    if (!className) return null;
    const scope = getEditFormScope();
    const node = Array.from(scope.querySelectorAll(`.${className}`))
      .filter((item) => !item.closest(`#${PANEL_ID}`) && visibleElement(item))
      .map((item) => item.closest('.ant-form-item') || item)
      .filter(Boolean)[0];
    if (!node) return null;
    const requiredStar = hasVisibleRequiredAttributeMarker(node);
    if (options.requireRequiredStar && !requiredStar) return null;
    return {
      node,
      text: elementText(node),
      requiredStar,
      rect: node.getBoundingClientRect(),
    };
  }

  function findRequiredAttributeExpandControl() {
    const scope = getEditFormScope();
    const roots = Array.from(scope.querySelectorAll('.attr-gray-container,.form-card,.form-card-content,.ant-form-item,div'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node))
      .map((node) => ({ node, text: elementText(node), rect: node.getBoundingClientRect() }))
      .filter((item) => item.text.includes('\u4ea7\u54c1\u5c5e\u6027') && item.text.includes('+\u5c55\u5f00') && item.text.length < 1800)
      .sort((a, b) => a.text.length - b.text.length || a.rect.top - b.rect.top);
    const container = roots[0] ? roots[0].node : scope;
    return Array.from(container.querySelectorAll('span.link,a,button,span,div'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node))
      .map((node) => ({ node, text: elementText(node), rect: node.getBoundingClientRect() }))
      .filter((item) => item.text === '+\u5c55\u5f00')
      .sort((a, b) => a.text.length - b.text.length || b.rect.left - a.rect.left)[0]?.node || null;
  }

  async function ensureRequiredAttributeExpanded(ruleId) {
    if (findDirectRequiredAttributeContainer(ruleId)) return { ok: true, expanded: false, mode: 'already-visible' };
    const className = getDirectRequiredAttributeClassName(ruleId);
    const scope = getEditFormScope();
    const hiddenNode = className ? scope.querySelector(`.${className}`) : null;
    if (!hiddenNode) return { ok: false, expanded: false, reason: 'direct attribute node not found' };
    const control = findRequiredAttributeExpandControl();
    if (!control) return { ok: false, expanded: false, reason: 'attribute expand control not found' };
    callReactHandler(control, 'onMouseDown', control);
    callReactHandler(control, 'onClick', control);
    clickElement(control);
    const start = Date.now();
    while (Date.now() - start < 2200) {
      await sleep(180);
      if (findDirectRequiredAttributeContainer(ruleId)) return { ok: true, expanded: true, mode: 'expand-control' };
    }
    return { ok: false, expanded: true, reason: 'attribute remained hidden after expand click' };
  }

  function getCurrentDropdownOptionText(option) {
    return firstNonEmpty(
      option && option.getAttribute && option.getAttribute('title'),
      option && option.querySelector && option.querySelector('.ant-select-item-option-content') && elementText(option.querySelector('.ant-select-item-option-content')),
      elementText(option)
    );
  }

  function collectVisibleSelectOptions(opener = null) {
    const roots = opener ? getActiveSelectDropdowns(opener) : getVisibleSelectDropdowns();
    const sourceRoots = roots.length ? roots : [document];
    const options = [];
    const seen = new Set();
    for (const root of sourceRoots) {
      const nodes = Array.from(root.querySelectorAll(
        '.ant-select-item-option,.ant-select-dropdown-menu-item,.select2-results__option,[role="option"],li'
      )).filter(visibleElement);
      for (const node of nodes) {
        if (
          node.getAttribute('aria-disabled') === 'true'
          || String(node.className || '').includes('disabled')
        ) continue;
        const optionNode = node.closest('.ant-select-item-option,.ant-select-dropdown-menu-item,.select2-results__option,[role="option"]') || node;
        const text = normalizeSpaces(getCurrentDropdownOptionText(optionNode));
        const normalized = normalizeSelectMatchText(text);
        if (!text || text.length > 220 || !normalized) continue;
        if (/\u6682\u65e0\u6570\u636e|\u65e0\u6570\u636e|no\s+data|not\s+found|\u641c\u7d22|\u8bf7\u9009\u62e9/i.test(text)) continue;
        const key = `${normalized}|${optionNode.getBoundingClientRect().top}`;
        if (seen.has(key)) continue;
        seen.add(key);
        options.push({ node: optionNode, text, normalized, rect: optionNode.getBoundingClientRect() });
      }
    }
    return options.sort((a, b) => a.rect.top - b.rect.top || a.text.length - b.text.length);
  }

  function scoreSafeVisibleSelectOption(option, values, fallbackKind = 'generic') {
    const text = option.normalized || normalizeSelectMatchText(option.text);
    if (!text) return -1;
    const wanted = values.map((value) => normalizeSelectMatchText(value)).filter(Boolean);
    const exactIndex = wanted.findIndex((value) => text === value || text.includes(value) || value.includes(text));
    if (exactIndex >= 0) return 100 - exactIndex;
    const raw = String(option.text || '');
    if (fallbackKind === 'frame_material') {
      if (/other|\u5176\u4ed6/i.test(raw)) return 92;
      if (/metal|steel|iron|alloy|\u91d1\u5c5e|\u94a2|\u94c1|\u5408\u91d1/i.test(raw)) return 42;
      if (/plastic|\u5851\u6599|acrylic|\u4e9a\u514b\u529b/i.test(raw)) return 38;
      return 12;
    }
    if (fallbackKind === 'material') {
      if (/metal|steel|iron|alloy|\u91d1\u5c5e|\u94a2|\u94c1|\u5408\u91d1/i.test(raw)) return 78;
      if (/silicone|\u7845\u80f6/i.test(raw)) return 74;
      if (/acrylic|\u4e9a\u514b\u529b/i.test(raw)) return 68;
      if (/plastic|\u5851\u6599/i.test(raw)) return 62;
      if (/other|\u5176\u4ed6/i.test(raw)) return 55;
      return 18;
    }
    if (fallbackKind === 'plastic_type') {
      if (/^PC(?:\s*\(PC\))?$/i.test(raw) || /\bPC\b/i.test(raw)) return 92;
      if (/polycarbonate|\u805a\u78b3\u9178\u916f/i.test(raw)) return 88;
      return 12;
    }
    if (fallbackKind === 'function' || fallbackKind === 'feature') {
      if (/other|\u5176\u4ed6/i.test(raw)) return 78;
      return 0;
    }
    if (fallbackKind === 'use') {
      if (/other|\u5176\u4ed6/i.test(raw)) return 78;
      if (fallbackKind === 'use' && /food|\u98df\u54c1|beverage|\u996e\u6599|bedding|\u5e8a\u4e0a\u7528\u54c1|clothing|\u8863\u670d/i.test(raw)) return -1;
      if (fallbackKind === 'use' && /sundries|\u6742\u8d27/i.test(raw)) return 76;
      if (/garage|\u8f66\u5e93|tools?|\u5de5\u5177/i.test(raw)) return -1;
      if (/office|\u529e\u516c|household|\u5bb6\u7528/i.test(raw)) return 72;
      if (/storage|organizer|organize|home|household|office|reusable|multi|general|\u6536\u7eb3|\u6574\u7406|\u5bb6\u5c45|\u5bb6\u7528|\u529e\u516c|\u53ef\u91cd\u590d|\u591a\u7528|\u901a\u7528/i.test(raw)) return 70;
      return 0;
    }
    if (fallbackKind === 'product_application_scenarios') {
      if (/kitchen|\u53a8\u623f/i.test(raw)) return 88;
      if (/dining\s*table|\u9910\u684c/i.test(raw)) return 82;
      if (/home|household|\u5bb6\u5c45|\u5bb6\u7528/i.test(raw)) return 60;
      return 18;
    }
    if (fallbackKind === 'theme') {
      if (/other|\u5176\u4ed6/i.test(raw)) return 88;
      return 18;
    }
    if (fallbackKind === 'origin') {
      if (/united states|\busa?\b|\u7f8e\u56fd/i.test(raw)) return 88;
      return 12;
    }
    if (/other|\u5176\u4ed6|none|\u65e0/i.test(raw)) return 60;
    return 20;
  }

  async function findSafeVisibleSelectOptionWithScroll(opener, values, fallbackKind, options = {}) {
    const deadlineAt = getDeadlineAt(options);
    const pickBest = () => {
      const scored = collectVisibleSelectOptions(opener)
        .map((item) => ({ ...item, score: scoreSafeVisibleSelectOption(item, values, fallbackKind) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score || a.rect.top - b.rect.top || a.text.length - b.text.length);
      return scored[0] || null;
    };
    let found = pickBest();
    if (found) return { option: found.node, optionText: found.text, score: found.score };
    const holders = getActiveSelectScrollContainers(opener);
    for (const holder of holders) {
      const maxScroll = Math.max(0, holder.scrollHeight - holder.clientHeight);
      const step = Math.max(160, Math.floor(holder.clientHeight * 0.9) || 180);
      for (let top = 0; top <= maxScroll + step; top += step) {
        if (isDeadlineExceeded(deadlineAt)) return null;
        holder.scrollTop = Math.min(top, maxScroll);
        holder.dispatchEvent(new Event('scroll', { bubbles: true }));
        await sleep(120);
        found = pickBest();
        if (found) return { option: found.node, optionText: found.text, score: found.score };
      }
    }
    return null;
  }

  function findExactOptionInActiveDropdown(opener, values) {
    const wanted = values.map((value) => normalizeSelectMatchText(value)).filter(Boolean);
    const rawWanted = values.map((value) => String(value || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
    const roots = getActiveSelectDropdowns(opener);
    for (const root of roots) {
      const options = Array.from(root.querySelectorAll('.ant-select-item-option,.ant-select-dropdown-menu-item,.select2-results__option,[role="option"],li'))
        .filter(visibleElement);
      for (const option of options) {
        const rawText = getCurrentDropdownOptionText(option);
        if (rawWanted.some((value) => rawText === value || rawText.includes(value))) return option;
        const text = normalizeSelectMatchText(rawText);
        if (wanted.some((value) => text === value || text.includes(value) || value.includes(text))) {
          return option;
        }
      }
    }
    return null;
  }

  async function findExactOptionInActiveDropdownWithListScroll(opener, values, options = {}) {
    const deadlineAt = getDeadlineAt(options);
    let option = findExactOptionInActiveDropdown(opener, values);
    if (option) return option;
    const holders = getActiveSelectScrollContainers(opener);
    for (const holder of holders) {
      const maxScroll = Math.max(0, holder.scrollHeight - holder.clientHeight);
      const step = Math.max(160, Math.floor(holder.clientHeight * 0.9) || 180);
      for (let top = 0; top <= maxScroll + step; top += step) {
        if (isDeadlineExceeded(deadlineAt)) return null;
        holder.scrollTop = Math.min(top, maxScroll);
        holder.dispatchEvent(new Event('scroll', { bubbles: true }));
        await sleep(120);
        option = findExactOptionInActiveDropdown(opener, values);
        if (option) return option;
      }
    }
    return null;
  }

  function findExactPostageTemplate111Option(opener) {
    const roots = getActiveSelectDropdowns(opener);
    for (const root of roots) {
      const options = Array.from(root.querySelectorAll('.ant-select-item-option,.ant-select-dropdown-menu-item,.select2-results__option,[role="option"],li'))
        .filter(visibleElement);
      for (const option of options) {
        const rawText = String(getCurrentDropdownOptionText(option) || elementText(option) || '').replace(/\s+/g, ' ').trim();
        const title = String(option.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
        if (isExactPostageTemplate111OptionText(rawText, title)) return option;
      }
    }
    return null;
  }

  async function findExactPostageTemplate111OptionWithListScroll(opener, options = {}) {
    const deadlineAt = getDeadlineAt(options);
    let option = findExactPostageTemplate111Option(opener);
    if (option) return option;
    const holders = getActiveSelectScrollContainers(opener);
    for (const holder of holders) {
      const maxScroll = Math.max(0, holder.scrollHeight - holder.clientHeight);
      const step = Math.max(160, Math.floor(holder.clientHeight * 0.9) || 180);
      for (let top = 0; top <= maxScroll + step; top += step) {
        if (isDeadlineExceeded(deadlineAt)) return null;
        holder.scrollTop = Math.min(top, maxScroll);
        holder.dispatchEvent(new Event('scroll', { bubbles: true }));
        await sleep(120);
        option = findExactPostageTemplate111Option(opener);
        if (option) return option;
      }
    }
    return null;
  }

  function findExactOptionInVisibleDropdowns(values, opener = null) {
    if (!opener) {
      for (const value of values) {
        const option = findVisibleSelectOptionExact(value);
        if (option) return option;
      }
    }
    const wanted = values.map((value) => normalizeSelectMatchText(value)).filter(Boolean);
    const rawWanted = values.map((value) => String(value || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
    for (const root of (opener ? getActiveSelectDropdowns(opener) : getVisibleSelectDropdowns())) {
      const options = Array.from(root.querySelectorAll('.ant-select-item-option,.ant-select-dropdown-menu-item,.select2-results__option,[role="option"],li,div,span'))
        .filter(visibleElement)
        .map((node) => ({ node, rawText: getCurrentDropdownOptionText(node) || elementText(node) }))
        .filter((item) => item.rawText && item.rawText.length < 700);
      for (const item of options) {
        if (rawWanted.some((value) => item.rawText === value || item.rawText.includes(value))) return item.node;
        const normalized = normalizeSelectMatchText(item.rawText);
        if (wanted.some((value) => normalized === value || normalized.includes(value) || value.includes(normalized))) return item.node;
      }
    }
    return null;
  }

  async function closeVisibleSelectDropdowns() {
    if (!getVisibleSelectDropdowns().length) return;
    const target = document.activeElement && document.activeElement !== document.body ? document.activeElement : document.body;
    dispatchKeyboardEvent(target, 'keydown', 'Escape');
    dispatchKeyboardEvent(target, 'keyup', 'Escape');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
    await sleep(180);
  }

  async function waitForExactOptionInVisibleDropdowns(values, timeoutMs = 1600, opener = null, options = {}) {
    const start = Date.now();
    const deadlineAt = getDeadlineAt(options);
    let option = findExactOptionInVisibleDropdowns(values, opener);
    while (!option && Date.now() - start < timeoutMs && !isDeadlineExceeded(deadlineAt)) {
      await sleep(180);
      option = findExactOptionInVisibleDropdowns(values, opener);
    }
    return option;
  }

  async function ensureCurrentSelectDropdownOpen(container, opener) {
    await closeVisibleSelectDropdowns();
    const localTargets = Array.from(container.querySelectorAll('.ant-select-selector,.ant-select-selection,input[role="combobox"],input[type="search"],input[type="text"],.ant-select'))
      .filter(visibleElement);
    const primary = localTargets.find((node) => /ant-select-selector|ant-select-selection/.test(String(node.className || '')))
      || localTargets.find((node) => node.matches && node.matches('input[role="combobox"],input[type="search"],input[type="text"]'))
      || opener;
    const selectRoot = primary && primary.closest ? primary.closest('.ant-select') : null;
    const input = (selectRoot && selectRoot.querySelector('input[role="combobox"],input[type="search"],input[type="text"]'))
      || (primary && primary.matches && primary.matches('input') ? primary : null);
    const targets = Array.from(new Set([primary, input, selectRoot, opener].filter(Boolean)));
    for (const target of targets) {
      const eventTarget = input || target;
      if (input && input.readOnly) input.removeAttribute('readonly');
      if (input && typeof input.focus === 'function') input.focus();
      callReactHandler(target, 'onMouseDown', eventTarget);
      callReactHandler(target, 'onClick', eventTarget);
      callReactHandler(eventTarget, 'onFocus', eventTarget);
      dispatchPointerMouseClick(target);
      clickElement(target);
      if (input) {
        input.dispatchEvent(new FocusEvent('focus', { bubbles: true, cancelable: false }));
        input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        input.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        dispatchKeyboardEvent(input, 'keydown', 'ArrowDown');
      }
      await sleep(420);
      if (getVisibleSelectDropdowns().length) return true;
    }
    return false;
  }

  async function filterOpenDropdownByValue(opener, value) {
    const input = findSelectSearchInputForOpenDropdown(opener)
      || (opener && opener.matches && opener.matches('input') ? opener : null)
      || (opener && opener.querySelector && opener.querySelector('input[role="combobox"],input[type="search"],input[type="text"]'));
    if (!input) return null;
    if (input.readOnly) input.removeAttribute('readonly');
    setSelectSearchInputValue(input, value);
    dispatchKeyboardEvent(input, 'keydown', value);
    await sleep(550);
    return input;
  }

  function activeDropdownShowsNoData(opener) {
    const roots = opener ? getActiveSelectDropdowns(opener) : getVisibleSelectDropdowns();
    return roots.some((root) => /\u6682\u65e0\u6570\u636e|\u65e0\u6570\u636e|no\s+data|not\s+found/i.test(elementText(root)));
  }

  async function clearOpenDropdownFilter(opener) {
    const input = findSelectSearchInputForOpenDropdown(opener)
      || (opener && opener.matches && opener.matches('input') ? opener : null)
      || (opener && opener.querySelector && opener.querySelector('input[role="combobox"],input[type="search"],input[type="text"]'));
    if (!input) return null;
    if (input.readOnly) input.removeAttribute('readonly');
    setSelectSearchInputValue(input, '');
    input.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'deleteContentBackward', data: null }));
    input.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'deleteContentBackward', data: null }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    dispatchKeyboardEvent(input, 'keyup', 'Backspace');
    await sleep(520);
    return input;
  }

  async function resetDropdownSearchToRecommendedOptions(opener) {
    const input = await clearOpenDropdownFilter(opener);
    if (!input) return { ok: false, reason: 'dropdown search input not found' };
    await sleep(260);
    return {
      ok: true,
      noData: activeDropdownShowsNoData(opener),
      options: collectVisibleSelectOptions(opener).map((item) => item.text).slice(0, 12),
    };
  }

  function getSelectInputControls(input) {
    if (!input) return [];
    return Array.from(new Set([
      input.getAttribute('aria-controls'),
      input.getAttribute('aria-owns'),
      input.getAttribute('aria-activedescendant') ? String(input.getAttribute('aria-activedescendant')).replace(/_\d+$/, '') : '',
    ].filter(Boolean)));
  }

  function getDropdownRootsForSelectInput(input, opener = null) {
    const roots = [];
    for (const id of getSelectInputControls(input)) {
      const node = document.getElementById(id);
      if (!node) continue;
      const root = node.closest('.ant-select-dropdown,.ant-select-dropdown-menu,.select2-dropdown,.rc-virtual-list') || node;
      roots.push(root);
    }
    roots.push(...getActiveSelectDropdowns(opener || input), ...getVisibleSelectDropdowns());
    return Array.from(new Set(roots)).filter(Boolean);
  }

  function getControlledDropdownRootsForSelectInput(input) {
    const roots = [];
    for (const id of getSelectInputControls(input)) {
      const node = document.getElementById(id);
      if (!node) continue;
      const root = node.closest('.ant-select-dropdown,.ant-select-dropdown-menu,.select2-dropdown,.rc-virtual-list') || node;
      roots.push(root);
    }
    return Array.from(new Set(roots)).filter(Boolean);
  }

  function findExactOptionInSelectInputDropdown(input, values, opener = null) {
    const wanted = values.map((value) => normalizeSelectMatchText(value)).filter(Boolean);
    const rawWanted = values.map((value) => String(value || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
    for (const root of getDropdownRootsForSelectInput(input, opener)) {
      const options = Array.from(root.querySelectorAll('.ant-select-item-option,.ant-select-dropdown-menu-item,.select2-results__option,[role="option"],li,div,span'))
        .map((node) => {
          const rawText = firstNonEmpty(
            node.getAttribute && node.getAttribute('aria-label'),
            node.getAttribute && node.getAttribute('title'),
            getCurrentDropdownOptionText(node),
            elementText(node)
          );
          const visibleOption = rawText ? Array.from(root.querySelectorAll('.ant-select-item-option,.ant-select-dropdown-menu-item,.select2-results__option'))
            .find((option) => firstNonEmpty(option.getAttribute('title'), option.getAttribute('aria-label'), getCurrentDropdownOptionText(option), elementText(option)) === rawText) : null;
          return {
            node: visibleOption || node.closest('.ant-select-item-option,.ant-select-dropdown-menu-item,.select2-results__option,[role="option"],li') || node,
            rawText,
          };
        })
        .filter((item) => item.rawText && item.rawText.length < 240);
      for (const item of options) {
        if (rawWanted.some((value) => item.rawText === value || item.rawText.includes(value))) return item.node;
        const normalized = normalizeSelectMatchText(item.rawText);
        if (wanted.some((value) => normalized === value || normalized.includes(value) || value.includes(normalized))) return item.node;
      }
    }
    return null;
  }

  async function selectAntMultipleExactValue(container, values, options = {}) {
    const deadlineAt = getDeadlineAt(options);
    const timeoutStage = options.timeoutStage || options.fieldId || 'multi-select';
    const timeout = (extra = {}) => buildStageTimeoutResult(timeoutStage, deadlineAt, { locked: false, ...extra });
    const verifyOptions = { requireCommittedOption: true, allowValidationIssue: Boolean(options.allowValidationIssue) };
    const before = verifySelectContainerValue(container, values, verifyOptions);
    if (before.ok) return { changed: false, ok: true, locked: true, selectedText: before.okText, mode: 'multi-already-selected', state: before };
    const selectRoot = Array.from(container.querySelectorAll('.ant-select-multiple')).filter(visibleElement)[0];
    if (!selectRoot) return { changed: false, ok: false, locked: false, reason: 'multi-select root not found' };
    const selector = selectRoot.querySelector('.ant-select-selector') || selectRoot;
    const input = selectRoot.querySelector('input[role="combobox"],input[type="search"],input[type="text"]');
    if (!input) return { changed: false, ok: false, locked: false, reason: 'multi-select search input not found' };
    if (input.readOnly) input.removeAttribute('readonly');
    const attempts = [];
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: false, attempts, reason: 'multi-select timeout before attempt' });
      await closeVisibleSelectDropdowns();
      const opened = await ensureCurrentSelectDropdownOpen(container, selector);
      callReactHandler(selectRoot, 'onMouseDown', input);
      callReactHandler(selector, 'onMouseDown', input);
      dispatchPointerMouseClick(selector);
      clickElement(selector);
      if (typeof input.focus === 'function') input.focus();
      input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      input.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      dispatchKeyboardEvent(input, 'keydown', 'ArrowDown');
      await sleep(260);
      if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: false, attempts, reason: 'multi-select timeout after open' });
      setSelectSearchInputValue(input, values[0]);
      dispatchKeyboardEvent(input, 'keyup', values[0]);
      dispatchKeyboardEvent(input, 'keydown', 'ArrowDown');
      await sleep(420);
      let option = findExactOptionInSelectInputDropdown(input, values, selector)
        || await findExactOptionInActiveDropdownWithListScroll(selector, values, { deadlineAt });
      if (!option) {
        dispatchKeyboardEvent(input, 'keydown', 'ArrowDown');
        await sleep(180);
        option = findExactOptionInSelectInputDropdown(input, values, selector);
      }
      const optionText = option ? getCurrentDropdownOptionText(option) || elementText(option) : '';
      const visibleOptions = getDropdownRootsForSelectInput(input, selector)
        .flatMap((root) => Array.from(root.querySelectorAll('.ant-select-item-option,[role="option"],li')).filter(visibleElement).map((node) => getCurrentDropdownOptionText(node) || elementText(node)).filter(Boolean))
        .slice(0, 12);
      attempts.push({ attempt, opened, optionText, found: Boolean(option), visibleOptions });
      if (option) {
        forceSelectOption(option);
        clickSelectOption(option);
        await sleep(360);
        input.dispatchEvent(new Event('change', { bubbles: true }));
        if (typeof input.blur === 'function') input.blur();
        input.dispatchEvent(new Event('blur', { bubbles: true }));
        const immediate = verifySelectContainerValue(container, values.concat(optionText ? [optionText] : []), verifyOptions);
        if (immediate.ok) {
          return {
            changed: true,
            ok: true,
            locked: true,
            selectedText: immediate.okText,
            optionText,
            acceptedValues: values.concat(optionText ? [optionText] : []),
            attempts,
            mode: 'ant-multiple-exact-option-click-immediate-readback',
            state: immediate,
          };
        }
        const after = await waitForSelectContainerValue(container, values.concat(optionText ? [optionText] : []), 900, { ...verifyOptions, deadlineAt });
        const fieldReadback = options.fieldId
          ? (getVisibleRequiredAttributeStatus().fields || []).find((item) => item && item.id === options.fieldId)
          : null;
        if (fieldReadback && fieldReadback.ok) {
          return {
            changed: true,
            ok: true,
            locked: true,
            selectedText: fieldReadback.selectedText || after.okText,
            optionText,
            acceptedValues: values.concat(optionText ? [optionText] : []),
            attempts,
            mode: 'ant-multiple-exact-option-click-field-readback',
            state: after,
            fieldReadback,
          };
        }
        if (after.ok) {
          return {
            changed: true,
            ok: true,
            locked: true,
            selectedText: after.okText,
            optionText,
            acceptedValues: values.concat(optionText ? [optionText] : []),
            attempts,
            mode: 'ant-multiple-exact-option-click',
            state: after,
          };
        }
        attempts[attempts.length - 1].readback = after.okText;
        attempts[attempts.length - 1].validationIssue = after.validationIssue || '';
        return {
          changed: true,
          ok: false,
          locked: false,
          selectedText: after.okText,
          optionText,
          acceptedValues: values.concat(optionText ? [optionText] : []),
          attempts,
          mode: 'ant-multiple-exact-option-click-readback-failed',
          state: after,
          reason: after.reason || after.validationIssue || 'multi-select exact value readback failed after option click',
        };
      }
      if (!opened && !visibleOptions.length) {
        await sleep(900);
        continue;
      }
      await clearOpenDropdownFilter(selector);
    }
    const after = verifySelectContainerValue(container, values, verifyOptions);
    const hasAnyOptions = attempts.some((item) => item.visibleOptions && item.visibleOptions.length);
    const reason = after.ok ? '' : (!hasAnyOptions ? 'multi-select dropdown did not open or produced no options' : 'multi-select exact value not committed');
    return { changed: attempts.some((item) => item.found), ok: after.ok, locked: after.ok, selectedText: after.okText, attempts, mode: 'ant-multiple-exact-option-click', state: after, reason };
  }

  async function selectFixedHighConcernedChemicalValue(container, values, deadlineAt) {
    const timeoutStage = 'high_concerned_chemical';
    const timeout = (extra = {}) => buildStageTimeoutResult(timeoutStage, deadlineAt, { locked: false, ...extra });
    const verifyOptions = { requireCommittedOption: true, allowValidationIssue: true };
    const before = verifySelectContainerValue(container, values, verifyOptions);
    if (before.ok) {
      return { changed: false, ok: true, locked: true, selectedText: before.okText, mode: 'high-chemical-already-selected', state: before };
    }
    const labelOk = VISIBLE_REQUIRED_ATTRIBUTE_RULES[1].label.test(elementText(container));
    if (!labelOk) {
      return { changed: false, ok: false, locked: false, reason: 'high-concerned chemical container label mismatch' };
    }
    const opener = Array.from(container.querySelectorAll('.ant-select-selector,.ant-select-selection,.ant-select,input[role="combobox"],input[type="search"],input[type="text"]'))
      .filter(visibleElement)[0];
    if (!opener) {
      return { changed: false, ok: false, locked: false, reason: 'high-concerned chemical dropdown opener not found' };
    }
    const attempts = [];
    const acceptedValues = values.slice();
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: attempts.some((item) => item.found), attempts, reason: 'high-concerned chemical timeout before attempt' });
      const opened = await ensureCurrentSelectDropdownOpen(container, opener);
      if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: false, attempts, reason: 'high-concerned chemical timeout after open' });
      const input = findSelectSearchInputForOpenDropdown(opener)
        || (opener && opener.matches && opener.matches('input') ? opener : null)
        || (opener && opener.querySelector && opener.querySelector('input[role="combobox"],input[type="search"],input[type="text"]'));
      if (input && input.readOnly) input.removeAttribute('readonly');
      if (attempt > 1 && input) {
        setSelectSearchInputValue(input, values[0]);
        dispatchKeyboardEvent(input, 'keydown', values[0]);
        dispatchKeyboardEvent(input, 'keyup', values[0]);
        await sleep(420);
      }
      let option = input ? findExactOptionInSelectInputDropdown(input, values, opener) : null;
      if (!option) option = await findExactOptionInActiveDropdownWithListScroll(opener, values, { deadlineAt });
      if (!option) option = await waitForExactOptionInVisibleDropdowns(values, attempt === 1 ? 700 : 1100, opener, { deadlineAt });
      const visibleOptions = (opener ? getActiveSelectDropdowns(opener) : getVisibleSelectDropdowns())
        .flatMap((root) => Array.from(root.querySelectorAll('.ant-select-item-option,[role="option"],li'))
          .filter(visibleElement)
          .map((node) => getCurrentDropdownOptionText(node) || elementText(node))
          .filter(Boolean))
        .slice(0, 12);
      const optionText = option ? getCurrentDropdownOptionText(option) || elementText(option) : '';
      attempts.push({ attempt, opened, found: Boolean(option), optionText, visibleOptions });
      if (!option) {
        await clearOpenDropdownFilter(opener);
        continue;
      }
      if (optionText) acceptedValues.push(optionText);
      forceSelectOption(option);
      clickSelectOption(option);
      await sleep(260);
      if (input) {
        input.dispatchEvent(new Event('change', { bubbles: true }));
        if (typeof input.blur === 'function') input.blur();
        input.dispatchEvent(new Event('blur', { bubbles: true }));
      }
      const blankConfirm = await confirmRequiredAttributeSelection(container, opener, input, deadlineAt);
      attempts[attempts.length - 1].blankConfirm = blankConfirm;
      if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: true, optionText, acceptedValues: Array.from(new Set(acceptedValues)), attempts, reason: 'high-concerned chemical timeout during blank confirm' });
      const uniqueAccepted = Array.from(new Set(acceptedValues));
      let after = await waitForSelectContainerValue(container, uniqueAccepted, 1500, { ...verifyOptions, deadlineAt });
      let fieldReadback = (getVisibleRequiredAttributeStatus().fields || []).find((item) => item && item.id === 'high_concerned_chemical');
      if (fieldReadback && fieldReadback.ok) {
        return {
          changed: true,
          ok: true,
          locked: true,
          selectedText: fieldReadback.selectedText || after.okText,
          optionText,
          acceptedValues: uniqueAccepted,
          attempts,
          mode: 'high-chemical-exact-option-field-readback',
          state: after,
          fieldReadback,
        };
      }
      if (!after.ok && !after.timedOut) {
        await sleep(450);
        after = await waitForSelectContainerValue(container, uniqueAccepted, 1200, { ...verifyOptions, deadlineAt });
        fieldReadback = (getVisibleRequiredAttributeStatus().fields || []).find((item) => item && item.id === 'high_concerned_chemical');
      }
      if (fieldReadback && fieldReadback.ok) {
        return {
          changed: true,
          ok: true,
          locked: true,
          selectedText: fieldReadback.selectedText || after.okText,
          optionText,
          acceptedValues: uniqueAccepted,
          attempts,
          mode: 'high-chemical-exact-option-delayed-field-readback',
          state: after,
          fieldReadback,
        };
      }
      if (after.ok) {
        return {
          changed: true,
          ok: true,
          locked: true,
          selectedText: after.okText,
          optionText,
          acceptedValues: uniqueAccepted,
          attempts,
          mode: 'high-chemical-exact-option-readback',
          state: after,
        };
      }
      attempts[attempts.length - 1].readback = after.okText;
      attempts[attempts.length - 1].validationIssue = after.validationIssue || '';
      if (after.timedOut || isDeadlineExceeded(deadlineAt)) return timeout({ changed: true, optionText, acceptedValues: uniqueAccepted, attempts, state: after, selectedText: after.okText, reason: 'high-concerned chemical timeout during readback' });
      await clearOpenDropdownFilter(opener);
    }
    const after = verifySelectContainerValue(container, values, verifyOptions);
    return {
      changed: attempts.some((item) => item.found),
      ok: after.ok,
      locked: after.ok,
      selectedText: after.okText,
      attempts,
      mode: 'high-chemical-exact-option-fast-path',
      state: after,
      reason: after.ok ? '' : 'high-concerned chemical exact value not committed',
    };
  }

  async function selectLockedDropdownOption(container, values, options = {}) {
    const deadlineAt = getDeadlineAt(options);
    const timeoutStage = options.timeoutStage || options.fieldId || 'dropdown';
    const timeout = (extra = {}) => buildStageTimeoutResult(timeoutStage, deadlineAt, { locked: false, ...extra });
    if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: false, reason: 'dropdown stage timeout before start' });
    const verifyOptions = { requireCommittedOption: Boolean(options.requireCommittedOption) };
    const before = verifySelectContainerValue(container, values, verifyOptions);
    if (before.ok) return { changed: false, ok: true, locked: true, selectedText: before.okText, mode: 'already-locked' };
    await clearMismatchedSelectValue(container, values);
    if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: true, reason: 'dropdown stage timeout after clearing value' });
    const opener = Array.from(container.querySelectorAll('.ant-select-selector,.ant-select-selection,.ant-select,input[role="combobox"],input[type="search"]'))
      .filter(visibleElement)[0];
    if (!opener) return { changed: false, ok: false, locked: false, reason: 'dropdown opener not found' };
    await ensureCurrentSelectDropdownOpen(container, opener);
    if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: false, reason: 'dropdown stage timeout after open' });
    await clearOpenDropdownFilter(opener);
    if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: false, reason: 'dropdown stage timeout after filter clear' });
    let filteredInput = null;
    let safeFallback = null;
    const dynamicAttributeDirectPick = Boolean(options.directRecommendedOptionFirst);
    let option = null;
    if (dynamicAttributeDirectPick && options.allowSafeVisibleOptionFallback) {
      await resetDropdownSearchToRecommendedOptions(opener);
      if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: false, reason: 'dropdown stage timeout after recommended reset' });
      safeFallback = await findSafeVisibleSelectOptionWithScroll(opener, values, options.safeFallbackKind || 'generic', { deadlineAt });
      if (safeFallback) option = safeFallback.option;
    }
    const controlledInput = findSelectSearchInputForOpenDropdown(opener)
      || (opener && opener.matches && opener.matches('input') ? opener : null)
      || (opener && opener.querySelector && opener.querySelector('input[role="combobox"],input[type="search"],input[type="text"]'));
    if (!option) option = controlledInput ? findExactOptionInSelectInputDropdown(controlledInput, values, opener) : null;
    if (!option) option = await findExactOptionInActiveDropdownWithListScroll(opener, values, { deadlineAt });
    if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: false, reason: 'dropdown stage timeout during option scan' });
    if (!option && dynamicAttributeDirectPick && options.allowSafeVisibleOptionFallback) {
      await resetDropdownSearchToRecommendedOptions(opener);
      if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: false, reason: 'dropdown stage timeout after recommended reset' });
      safeFallback = await findSafeVisibleSelectOptionWithScroll(opener, values, options.safeFallbackKind || 'generic', { deadlineAt });
      if (safeFallback) option = safeFallback.option;
    }
    if (!option && options.prefilterFirstValue && values[0]) {
      filteredInput = await filterOpenDropdownByValue(opener, values[0]);
      if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: false, reason: 'dropdown stage timeout after first-value filter' });
      if (!option) option = await findExactOptionInActiveDropdownWithListScroll(opener, [values[0]], { deadlineAt });
      if (!option) option = await waitForExactOptionInVisibleDropdowns([values[0]], 1400, opener, { deadlineAt });
    }
    if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: false, reason: 'dropdown stage timeout during first-value wait' });
    if (!option) option = await findExactOptionInActiveDropdownWithListScroll(opener, values, { deadlineAt });
    if (!option) {
      await ensureCurrentSelectDropdownOpen(container, opener);
      if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: false, reason: 'dropdown stage timeout during reopen' });
      await clearOpenDropdownFilter(opener);
      if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: false, reason: 'dropdown stage timeout during second filter clear' });
      option = await findExactOptionInActiveDropdownWithListScroll(opener, values, { deadlineAt });
    }
    if (!option) {
      option = await waitForExactOptionInVisibleDropdowns(values, 1800, opener, { deadlineAt });
    }
    if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: false, reason: 'dropdown stage timeout waiting exact option' });
    if (!option) {
      for (const value of values) {
        if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: false, reason: 'dropdown stage timeout during value iteration' });
        await filterOpenDropdownByValue(opener, value);
        if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: false, reason: 'dropdown stage timeout after value filter' });
        option = await findExactOptionInActiveDropdownWithListScroll(opener, [value], { deadlineAt });
        if (!option) option = await waitForExactOptionInVisibleDropdowns([value], 1400, opener, { deadlineAt });
        if (option) break;
        if (activeDropdownShowsNoData(opener)) {
          await resetDropdownSearchToRecommendedOptions(opener);
          if (options.allowSafeVisibleOptionFallback) {
            if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: false, reason: 'dropdown stage timeout during no-data reset' });
            safeFallback = await findSafeVisibleSelectOptionWithScroll(opener, values, options.safeFallbackKind || 'generic', { deadlineAt });
            if (safeFallback) {
              option = safeFallback.option;
              break;
            }
          }
        }
      }
    }
    if (!option && options.allowSafeVisibleOptionFallback) {
      await ensureCurrentSelectDropdownOpen(container, opener);
      await resetDropdownSearchToRecommendedOptions(opener);
      if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: false, reason: 'dropdown stage timeout before safe fallback' });
      safeFallback = await findSafeVisibleSelectOptionWithScroll(opener, values, options.safeFallbackKind || 'generic', { deadlineAt });
      if (safeFallback) option = safeFallback.option;
    }
    if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: false, reason: 'dropdown stage timeout before option commit' });
    if (!option) return { changed: false, ok: false, locked: false, reason: 'fixed option not found in active dropdown', values };
    const optionText = safeFallback ? safeFallback.optionText : getCurrentDropdownOptionText(option);
    const acceptedValues = safeFallback && optionText
      ? Array.from(new Set(values.concat([optionText])))
      : values;
    if (options.hoverKeyboardOnly) {
      forceSelectOption(option);
      hoverSelectOption(option);
    } else {
      forceSelectOption(option);
    }
    await sleep(260);
    if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: true, optionText, acceptedValues, reason: 'dropdown stage timeout after option click' });
    const input = filteredInput || Array.from(container.querySelectorAll('input[role="combobox"],input[type="search"],input[type="text"]')).filter(visibleElement)[0];
    const dynamicAttributeNoKeyboardCommit = options.noKeyboardCommitForDynamicAttributes
      || /^(?:function|use|feature)$/i.test(String(options.safeFallbackKind || ''));
    if (options.confirmWithKeyboard && input && !dynamicAttributeNoKeyboardCommit) {
      if (typeof input.focus === 'function') input.focus();
      for (const key of ['Enter', 'Tab']) {
          dispatchKeyboardEvent(input, 'keydown', key);
          dispatchKeyboardEvent(input, 'keypress', key);
          dispatchKeyboardEvent(input, 'keyup', key);
          await sleep(320);
          if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: true, optionText, acceptedValues, reason: 'dropdown stage timeout during keyboard commit' });
        }
      }
    if (options.skipKeyboardCommit || dynamicAttributeNoKeyboardCommit) {
      if (input) {
        input.dispatchEvent(new Event('change', { bubbles: true }));
        if (typeof input.blur === 'function') input.blur();
        input.dispatchEvent(new Event('blur', { bubbles: true }));
      }
    } else {
      commitSelectControl(container, input);
    }
    let blankConfirm = null;
    if (options.confirmRequiredAttributeSelection) {
      blankConfirm = await confirmRequiredAttributeSelection(container, opener, input, deadlineAt);
      if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: true, optionText, acceptedValues, blankConfirm, reason: 'dropdown stage timeout during blank confirm' });
    }
    let after = await waitForSelectContainerValue(container, acceptedValues, 1200, { ...verifyOptions, deadlineAt });
    if (after.timedOut || isDeadlineExceeded(deadlineAt)) return timeout({ changed: true, optionText, acceptedValues, state: after, selectedText: after.okText, reason: 'dropdown stage timeout during readback' });
    let retriedWithoutKeyboard = false;
    if (!after.ok && after.unsafeDisplay && dynamicAttributeNoKeyboardCommit) {
      retriedWithoutKeyboard = true;
      await clearMismatchedSelectValue(container, acceptedValues);
      await ensureCurrentSelectDropdownOpen(container, opener);
      await resetDropdownSearchToRecommendedOptions(opener);
      if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: true, optionText, acceptedValues, state: after, selectedText: after.okText, reason: 'dropdown stage timeout before unsafe retry' });
      let retryOption = await findExactOptionInActiveDropdownWithListScroll(opener, acceptedValues, { deadlineAt });
      let retrySafeFallback = null;
      if (!retryOption && options.allowSafeVisibleOptionFallback) {
        retrySafeFallback = await findSafeVisibleSelectOptionWithScroll(opener, acceptedValues, options.safeFallbackKind || 'generic', { deadlineAt });
        if (retrySafeFallback) retryOption = retrySafeFallback.option;
      }
      if (retryOption) {
        forceSelectOption(retryOption);
        await sleep(260);
        const retryInput = Array.from(container.querySelectorAll('input[role="combobox"],input[type="search"],input[type="text"]')).filter(visibleElement)[0];
        if (retryInput) {
          retryInput.dispatchEvent(new Event('change', { bubbles: true }));
          if (typeof retryInput.blur === 'function') retryInput.blur();
          retryInput.dispatchEvent(new Event('blur', { bubbles: true }));
        }
        if (options.confirmRequiredAttributeSelection) {
          blankConfirm = await confirmRequiredAttributeSelection(container, opener, retryInput, deadlineAt);
          if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: true, optionText, acceptedValues, blankConfirm, reason: 'dropdown stage timeout during retry blank confirm' });
        }
        if (retrySafeFallback && retrySafeFallback.optionText) acceptedValues.push(retrySafeFallback.optionText);
        after = await waitForSelectContainerValue(container, Array.from(new Set(acceptedValues)), 1400, { ...verifyOptions, deadlineAt });
      }
    }
    if (after.timedOut || isDeadlineExceeded(deadlineAt)) return timeout({ changed: true, optionText, acceptedValues, state: after, selectedText: after.okText, reason: 'dropdown stage timeout after unsafe retry' });
    return {
      changed: true,
      ok: after.ok,
      locked: after.ok,
      selectedText: after.okText,
      optionText,
      acceptedValues,
      mode: options.hoverKeyboardOnly
        ? 'fixed-option-hover-keyboard-lock'
        : safeFallback
          ? 'safe-visible-option-click-lock'
          : options.confirmWithKeyboard
          ? 'fixed-option-click-keyboard-lock'
          : options.skipKeyboardCommit || dynamicAttributeNoKeyboardCommit
            ? 'fixed-option-click-no-keyboard-lock'
            : 'fixed-option-click-lock',
      retriedWithoutKeyboard,
      blankConfirm,
      state: after,
    };
  }

  function lockEditField(fieldId, container, values) {
    const stateInfo = verifySelectContainerValue(container, values, { requireCommittedOption: true });
    editFieldLocks.fields[fieldId] = {
      locked: stateInfo.ok,
      selectedText: stateInfo.okText,
      lockedAt: nowIso(),
      values: values.slice(),
    };
    return editFieldLocks.fields[fieldId];
  }

  function verifyEditFieldLock(fieldId, container, values) {
    const lock = editFieldLocks.fields[fieldId];
    const stateInfo = verifySelectContainerValue(container, values, { requireCommittedOption: true });
    if (!lock || !lock.locked) return { locked: false, ok: stateInfo.ok, selectedText: stateInfo.okText, state: stateInfo };
    const ok = stateInfo.ok;
    if (!ok) {
      editFieldLocks.lockViolations.push({
        fieldId,
        expected: values.slice(),
        actual: stateInfo.okText,
        at: nowIso(),
      });
    }
    return { locked: true, ok, selectedText: stateInfo.okText, state: stateInfo };
  }

  async function runMinimalExclusiveFieldPipeline() {
    const steps = [
      {
        id: 'chemical',
        directId: 'high_concerned_chemical',
        values: ['\u5929\u7136\u672a\u5904\u7406(None)'],
        options: { confirmWithKeyboard: true, hoverKeyboardOnly: true },
      },
      {
        id: 'origin',
        directId: 'origin',
        values: ['\u7f8e\u56fd(Origin)(US(Origin))'],
        options: {},
      },
    ];
    const results = [];
    for (const step of steps) {
      const item = findDirectRequiredAttributeContainer(step.directId);
      if (!item) {
        const result = { id: step.id, ok: false, locked: false, changed: false, reason: 'field container not found' };
        results.push(result);
        return { ok: false, changed: results.some((entry) => entry.changed), stoppedAt: step.id, results, locks: { ...editFieldLocks.fields } };
      }
      const currentLock = verifyEditFieldLock(step.id, item.node, step.values);
      if (currentLock.locked && currentLock.ok) {
        results.push({ id: step.id, ok: true, locked: true, changed: false, selectedText: currentLock.selectedText, mode: 'already-field-locked' });
        continue;
      }
      const result = await selectLockedDropdownOption(item.node, step.values, {
        ...step.options,
        confirmRequiredAttributeSelection: true,
      });
      if (result.ok) lockEditField(step.id, item.node, step.values);
      results.push({ id: step.id, ...result, lock: editFieldLocks.fields[step.id] || null });
      if (!result.ok) {
        return { ok: false, changed: results.some((entry) => entry.changed), stoppedAt: step.id, results, locks: { ...editFieldLocks.fields } };
      }
    }
    return {
      ok: results.every((entry) => entry.ok),
      changed: results.some((entry) => entry.changed),
      results,
      locks: { ...editFieldLocks.fields },
    };
  }

  async function applyMinimalExclusiveEditPageRules() {
    if (visibleEditRulesPipelineRunning) {
      return state.visibleEditRuleResult || { skipped: true, reason: 'minimal exclusive pipeline already running' };
    }
    visibleEditRulesPipelineRunning = true;
    return withExclusiveEditExecution(async () => {
      try {
        const beforeScrollY = window.scrollY;
        const requiredAttributes = await runMinimalExclusiveFieldPipeline();
        await sleep(600);
        const afterStatus = {
          chemical: (() => {
            const item = findDirectRequiredAttributeContainer('high_concerned_chemical');
            return item ? verifySelectContainerValue(item.node, ['\u5929\u7136\u672a\u5904\u7406(None)']) : { ok: false, okText: '', reason: 'field container not found' };
          })(),
          origin: (() => {
            const item = findDirectRequiredAttributeContainer('origin');
            return item ? verifySelectContainerValue(item.node, ['\u7f8e\u56fd(Origin)(US(Origin))']) : { ok: false, okText: '', reason: 'field container not found' };
          })(),
        };
        const result = {
          at: nowIso(),
          mode: 'minimal-exclusive-field-lock',
          manual: true,
          requiredAttributes,
          afterStatus,
          scroll: {
            before: beforeScrollY,
            after: window.scrollY,
            blocked: editFieldLocks.scrollBlocked,
          },
          locks: { ...editFieldLocks.fields },
          lockViolations: editFieldLocks.lockViolations.slice(),
          ok: requiredAttributes.ok && afterStatus.chemical.ok && afterStatus.origin.ok && editFieldLocks.lockViolations.length === 0,
        };
        state.visibleEditRuleResult = result;
        if (!state.report) state.report = {};
        state.report.visibleEditRuleResult = result;
        log(`\u6700\u5c0f\u72ec\u5360\u9a8c\u8bc1\uff1a\u9ad8\u5173\u6ce8${afterStatus.chemical.ok ? '\u5df2\u9501\u5b9a' : '\u672a\u9501\u5b9a'}\uff0c\u4ea7\u5730${afterStatus.origin.ok ? '\u5df2\u9501\u5b9a' : '\u672a\u9501\u5b9a'}\uff0c\u62e6\u622a\u6eda\u52a8${editFieldLocks.scrollBlocked}\u6b21`, result);
        updateUi();
        return result;
      } finally {
        visibleEditRulesPipelineRunning = false;
      }
    });
  }

  function getCheckedTextsInContainer(container) {
    return Array.from(container.querySelectorAll('input[type="checkbox"],input[type="radio"]'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && node.checked)
      .map((node) => checkboxNearbyText(node))
      .filter(Boolean);
  }

  function checkboxTextMatchesCandidate(text, values) {
    const normalizedText = normalizeCategoryText(text);
    return values.some((value) => {
      const wanted = normalizeCategoryText(value);
      return wanted && (normalizedText.includes(wanted) || wanted.includes(normalizedText));
    });
  }

  async function selectRequiredAttributeCheckboxValue(container, values, options = {}) {
    const controls = Array.from(container.querySelectorAll('input[type="checkbox"],input[type="radio"]'))
      .filter((node) => !node.closest(`#${PANEL_ID}`))
      .filter((node) => visibleElement(node) || visibleElement(node.closest('label')) || visibleElement(node.parentElement));
    if (!controls.length) return { handled: false };
    const checkedTexts = getCheckedTextsInContainer(container);
    if (checkedTexts.some((text) => checkboxTextMatchesCandidate(text, values))) {
      return { handled: true, changed: false, ok: true, selectedText: checkedTexts.join(' '), mode: 'checkbox-already-selected' };
    }

    const candidates = [];
    for (const value of values) {
      const wanted = normalizeCategoryText(value);
      if (!wanted) continue;
      const found = controls.find((node) => {
        const text = normalizeCategoryText(checkboxNearbyText(node));
        return text && (text.includes(wanted) || wanted.includes(text));
      });
      if (found && !candidates.includes(found)) candidates.push(found);
      if (found && !options.allowMultipleCheckboxes) break;
    }

    if (!candidates.length) {
      const scored = controls
        .map((node) => {
          const text = checkboxNearbyText(node);
          return {
            node,
            text,
            score: scoreSafeVisibleSelectOption({ text, normalized: normalizeSelectMatchText(text) }, values, options.safeFallbackKind || 'generic'),
          };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score);
      if (scored[0]) candidates.push(scored[0].node);
    }

    if (!candidates.length) {
      return { handled: true, changed: false, ok: false, locked: false, reason: 'required checkbox/radio option not found', values };
    }

    let changed = false;
    const isRadio = candidates.some((node) => String(node.type || '').toLowerCase() === 'radio');
    const selected = isRadio || !options.allowMultipleCheckboxes ? candidates.slice(0, 1) : candidates;
    for (const node of selected) {
      changed = setCheckboxChecked(node, true) || changed;
      await sleep(180);
    }
    const afterTexts = getCheckedTextsInContainer(container);
    const ok = afterTexts.some((text) => checkboxTextMatchesCandidate(text, values))
      || selected.some((node) => node.checked);
    return {
      handled: true,
      changed,
      ok,
      locked: ok,
      selectedText: afterTexts.join(' ') || selected.map((node) => checkboxNearbyText(node)).filter(Boolean).join(' '),
      optionText: selected.map((node) => checkboxNearbyText(node)).filter(Boolean).join(' | '),
      acceptedValues: Array.from(new Set(values.concat(afterTexts))),
      mode: options.allowMultipleCheckboxes && selected.length > 1 ? 'checkbox-multiple' : 'checkbox',
      reason: ok ? '' : 'required checkbox/radio option did not read back checked',
    };
  }

  async function selectRequiredAttributeStepValue(item, step, deadlineAt) {
    const checkboxResult = await selectRequiredAttributeCheckboxValue(item.node, step.values, {
      allowMultipleCheckboxes: Boolean(step.allowMultipleCheckboxes),
      safeFallbackKind: step.safeFallbackKind,
    });
    if (checkboxResult.handled) return checkboxResult;
    if (step.id === 'use') {
      const useFastPath = await selectVisibleUseDropdownFastPath(item.node, step.values, deadlineAt);
      if (useFastPath.ok || useFastPath.timedOut) return useFastPath;
    }
    return selectLockedDropdownOption(item.node, step.values, {
      confirmWithKeyboard: step.confirmWithKeyboard,
      hoverKeyboardOnly: step.hoverKeyboardOnly,
      skipKeyboardCommit: step.skipKeyboardCommit,
      noKeyboardCommitForDynamicAttributes: step.noKeyboardCommitForDynamicAttributes,
      prefilterFirstValue: step.prefilterFirstValue,
      requireCommittedOption: step.requireCommittedOption,
      allowSafeVisibleOptionFallback: step.allowSafeVisibleOptionFallback,
      safeFallbackKind: step.safeFallbackKind,
      directRecommendedOptionFirst: step.directRecommendedOptionFirst,
      confirmRequiredAttributeSelection: true,
      deadlineAt,
      timeoutStage: step.id,
    });
  }

  async function selectVisibleUseDropdownFastPath(container, values, deadlineAt) {
    const timeout = (extra = {}) => buildStageTimeoutResult('required-attributes.use', deadlineAt, { locked: false, ...extra });
    if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: false, reason: 'use fast path timeout before start' });
    const before = verifySelectContainerValue(container, values, { requireCommittedOption: true });
    if (before.ok) return { changed: false, ok: true, locked: true, selectedText: before.okText, mode: 'use-fast-already-locked', state: before };
    const opener = Array.from(container.querySelectorAll('.ant-select-selector,.ant-select-selection,.ant-select,input[role="combobox"],input[type="search"]'))
      .filter(visibleElement)[0];
    if (!opener) return { changed: false, ok: false, locked: false, reason: 'use dropdown opener not found' };
    opener.scrollIntoView({ block: 'center' });
    await sleep(180);
    opener.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    opener.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
    if (typeof opener.click === 'function') opener.click();
    await sleep(700);
    if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: false, reason: 'use fast path timeout after open' });
    const scored = collectVisibleSelectOptions(opener)
      .map((entry) => ({ ...entry, score: scoreSafeVisibleSelectOption(entry, values, 'use') }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.rect.top - b.rect.top || a.text.length - b.text.length);
    const selected = scored[0];
    if (!selected) return { changed: false, ok: false, locked: false, reason: 'use fast path option not visible', values };
    forceSelectOption(selected.node);
    await sleep(500);
    const input = Array.from(container.querySelectorAll('input[role="combobox"],input[type="search"],input[type="text"]')).filter(visibleElement)[0];
    if (input) {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      if (typeof input.blur === 'function') input.blur();
      input.dispatchEvent(new Event('blur', { bubbles: true }));
    }
    const acceptedValues = Array.from(new Set(values.concat([selected.text])));
    const blankConfirm = await confirmRequiredAttributeSelection(container, opener, input, deadlineAt);
    if (isDeadlineExceeded(deadlineAt)) {
      return timeout({ changed: true, optionText: selected.text, acceptedValues, blankConfirm, reason: 'use fast path timeout during blank confirm' });
    }
    await sleep(500);
    let after = verifySelectContainerValue(container, acceptedValues, { requireCommittedOption: true });
    const fieldReadback = (getVisibleRequiredAttributeStatus().fields || []).find((entry) => entry && entry.id === 'use');
    if (!after.ok && fieldReadback && fieldReadback.ok) {
      return {
        changed: true,
        ok: true,
        locked: true,
        selectedText: fieldReadback.selectedText || selected.text,
        optionText: selected.text,
        acceptedValues,
        mode: 'use-fast-field-readback',
        blankConfirm,
        state: after,
        fieldReadback,
      };
    }
    return {
      changed: true,
      ok: after.ok,
      locked: after.ok,
      selectedText: after.okText || (fieldReadback && fieldReadback.selectedText) || selected.text,
      optionText: selected.text,
      acceptedValues,
      mode: 'use-fast-visible-option',
      blankConfirm,
      state: after,
      fieldReadback,
      reason: after.ok ? '' : 'use fast path option did not read back',
    };
  }

  function getPlasticTypeCandidateValues() {
    return ['PC(PC)', 'PC', 'Polycarbonate', '\u805a\u78b3\u9178\u916f(PC)', '\u805a\u78b3\u9178\u916f'];
  }

  function materialSelectionRequiresPlasticType(selectedText) {
    return /plastic|\u5851\u6599/i.test(String(selectedText || ''));
  }

  function findPlasticTypeAttributeContainer() {
    const labelPattern = /plastic\s*type|\u5851\u6599(?:\u7c7b\u578b|\u79cd\u7c7b)|\u5851\u6599\u6750\u8d28/i;
    return findVisibleAttributeContainers()
      .filter((candidate) => {
        const labelText = getAttributeContainerLabelText(candidate.node);
        const fieldText = labelText || candidate.text.slice(0, 180);
        return labelPattern.test(fieldText);
      })
      .filter((candidate) => candidate.node.querySelector('.ant-select,input[role="combobox"],input[type="search"],input[type="text"]'))
      .map((candidate) => ({
        ...candidate,
        requiredStar: hasVisibleRequiredAttributeMarker(candidate.node),
        score: (getAttributeContainerLabelText(candidate.node) || candidate.text).length + Math.round(candidate.rect.height),
      }))
      .sort((a, b) => a.score - b.score || a.rect.top - b.rect.top)[0] || null;
  }

  async function selectVisiblePlasticTypePcIfPresent(deadlineAt) {
    const item = findPlasticTypeAttributeContainer();
    if (!item) return { ok: true, changed: false, skipped: true, reason: 'plastic type field not visible' };
    const values = getPlasticTypeCandidateValues();
    const before = verifySelectContainerValue(item.node, values, { requireCommittedOption: true });
    if (before.ok) {
      lockRequiredAttributeField('plastic_type', item.node, values, { ok: true, selectedText: before.okText, mode: 'already-selected-readback' });
      return { ok: true, changed: false, locked: true, selectedText: before.okText, mode: 'already-selected-readback', state: before };
    }
    const result = await selectLockedDropdownOption(item.node, values, {
      confirmWithKeyboard: false,
      skipKeyboardCommit: true,
      noKeyboardCommitForDynamicAttributes: true,
      prefilterFirstValue: true,
      requireCommittedOption: true,
      allowSafeVisibleOptionFallback: true,
      safeFallbackKind: 'plastic_type',
      confirmRequiredAttributeSelection: true,
      deadlineAt,
      timeoutStage: 'plastic_type',
      fieldId: 'plastic_type',
    });
    const acceptedValues = (result.acceptedValues && result.acceptedValues.length) ? result.acceptedValues : values;
    if (result.ok) lockRequiredAttributeField('plastic_type', item.node, acceptedValues, result);
    return { ...result, values: acceptedValues, lock: editFieldLocks.fields.plastic_type || null };
  }

  async function selectMaterialDropdownFastPath(container, values, deadlineAt) {
    const timeout = (extra = {}) => buildStageTimeoutResult('required-attributes.material', deadlineAt, { locked: false, ...extra });
    if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: false, reason: 'material fast path timeout before start' });
    const before = verifySelectContainerValue(container, values, { requireCommittedOption: true });
    if (before.ok) return { changed: false, ok: true, locked: true, selectedText: before.okText, mode: 'material-fast-already-locked', state: before };
    await clearMismatchedSelectValue(container, values);
    if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: true, reason: 'material fast path timeout after clear' });
    const opener = Array.from(container.querySelectorAll('.ant-select-selector,.ant-select-selection,.ant-select,input[role="combobox"],input[type="search"]'))
      .filter(visibleElement)[0];
    if (!opener) return { changed: false, ok: false, locked: false, reason: 'material dropdown opener not found' };
    await ensureCurrentSelectDropdownOpen(container, opener);
    await resetDropdownSearchToRecommendedOptions(opener);
    if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: false, reason: 'material fast path timeout after open' });
    const controlledInput = findSelectSearchInputForOpenDropdown(opener)
      || Array.from(container.querySelectorAll('input[role="combobox"],input[type="search"],input[type="text"]')).filter(visibleElement)[0];
    const controlledRoots = getControlledDropdownRootsForSelectInput(controlledInput);
    const exactOption = controlledInput ? findExactOptionInSelectInputDropdown(controlledInput, values, opener) : null;
    const exactOptionText = exactOption ? normalizeSpaces(getCurrentDropdownOptionText(exactOption) || elementText(exactOption)) : '';

    let picked = exactOption
      ? { option: exactOption, optionText: exactOptionText }
      : findVisibleOptionByCandidateValuesInRoots(values, controlledRoots)
      || findVisibleOptionByCandidateValues(values, opener)
      || await findVisibleOptionByCandidateValuesWithScroll(values, opener, { deadlineAt })
      || await findSafeVisibleSelectOptionWithScroll(opener, values, 'material', { deadlineAt });
    if (!picked && !isDeadlineExceeded(deadlineAt)) {
      const firstValue = values.find(Boolean);
      if (firstValue) {
        await filterOpenDropdownByValue(opener, firstValue);
        picked = findVisibleOptionByCandidateValues([firstValue], opener)
          || await findVisibleOptionByCandidateValuesWithScroll([firstValue], opener, { deadlineAt });
      }
    }
    if (isDeadlineExceeded(deadlineAt)) return timeout({ changed: false, reason: 'material fast path timeout during option pick' });
    if (!picked) return { changed: false, ok: false, locked: false, reason: 'material visible option not found', values };

    const option = picked.option || picked.node;
    const optionText = normalizeSpaces(picked.optionText || picked.text || getCurrentDropdownOptionText(option));
    const acceptedValues = Array.from(new Set(values.concat(optionText ? [optionText] : [])));
    forceSelectOption(option);
    await sleep(260);
    const input = Array.from(container.querySelectorAll('input[role="combobox"],input[type="search"],input[type="text"]')).filter(visibleElement)[0];
    if (input) {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      if (typeof input.blur === 'function') input.blur();
      input.dispatchEvent(new Event('blur', { bubbles: true }));
    }
    const blankConfirm = await confirmRequiredAttributeSelection(container, opener, input, deadlineAt);
    if (isDeadlineExceeded(deadlineAt)) {
      return timeout({ changed: true, optionText, acceptedValues, blankConfirm, reason: 'material fast path timeout during blank confirm' });
    }
    const after = await waitForSelectContainerValue(container, acceptedValues, 1600, {
      requireCommittedOption: true,
      deadlineAt,
    });
    if (after.timedOut || isDeadlineExceeded(deadlineAt)) {
      return timeout({ changed: true, optionText, acceptedValues, selectedText: after.okText, state: after, reason: 'material fast path timeout during readback' });
    }
    return {
      changed: true,
      ok: after.ok,
      locked: after.ok,
      selectedText: after.okText,
      optionText,
      acceptedValues,
      mode: 'material-fast-visible-option-click-lock',
      blankConfirm,
      state: after,
      reason: after.ok ? '' : 'material fast path value did not read back cleanly',
    };
  }

  async function selectRequiredMaterialAttributeValue(item, step, deadlineAt) {
    const values = step.values || getVisibleMaterialCandidateValues();
    let lastResult = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (isDeadlineExceeded(deadlineAt)) {
        return buildStageTimeoutResult('required-attributes.material', deadlineAt, {
          changed: Boolean(lastResult && lastResult.changed),
          reason: 'material stage timeout before retry',
          lastResult,
        });
      }
      const currentItem = attempt === 0
        ? item
        : (findDirectRequiredAttributeContainer('material', { requireRequiredStar: true }) || item);
      if (!currentItem || !currentItem.node) {
        return { changed: Boolean(lastResult && lastResult.changed), ok: false, locked: false, reason: 'material field container not found', lastResult };
      }
      const before = verifySelectContainerValue(currentItem.node, values, { requireCommittedOption: true });
      if (before.ok) {
        const plasticType = materialSelectionRequiresPlasticType(before.okText)
          ? await selectVisiblePlasticTypePcIfPresent(deadlineAt)
          : { ok: true, changed: false, skipped: true, reason: 'material is not plastic' };
        return {
          changed: Boolean(plasticType.changed),
          ok: plasticType.ok,
          locked: plasticType.ok,
          selectedText: before.okText,
          mode: 'material-already-selected-readback',
          state: before,
          plasticType,
        };
      }

      const checkboxResult = await selectRequiredAttributeCheckboxValue(currentItem.node, values, {
        allowMultipleCheckboxes: Boolean(step.allowMultipleCheckboxes),
        safeFallbackKind: 'material',
      });
      const result = checkboxResult.handled
        ? checkboxResult
        : await selectMaterialDropdownFastPath(currentItem.node, values, deadlineAt);
      lastResult = result;
      const selectedText = firstNonEmpty(result.selectedText, result.optionText, result.state && result.state.okText, '');
      if (result.ok) {
        const plasticType = materialSelectionRequiresPlasticType(selectedText)
          ? await selectVisiblePlasticTypePcIfPresent(deadlineAt)
          : { ok: true, changed: false, skipped: true, reason: 'material is not plastic' };
        return {
          ...result,
          ok: result.ok && plasticType.ok,
          locked: result.ok && plasticType.ok,
          selectedText,
          acceptedValues: (result.acceptedValues && result.acceptedValues.length) ? result.acceptedValues : values,
          plasticType,
          mode: result.mode ? `${result.mode}+material-specialized` : 'material-specialized',
          reason: plasticType.ok ? result.reason : `plastic type failed: ${plasticType.reason || 'readback failed'}`,
        };
      }
      if (result.timedOut || isDeadlineExceeded(deadlineAt)) return result;
      await ensureRequiredAttributeExpanded('material');
      await sleep(320);
    }
    return { ...(lastResult || {}), ok: false, locked: false, reason: (lastResult && lastResult.reason) || 'material selection failed after retry' };
  }

  function lockRequiredAttributeField(fieldId, container, values, result) {
    const checkedTexts = getCheckedTextsInContainer(container);
    if (checkedTexts.length) {
      editFieldLocks.fields[fieldId] = {
        locked: Boolean(result && result.ok),
        selectedText: checkedTexts.join(' '),
        lockedAt: nowIso(),
        values: values.slice(),
      };
      return editFieldLocks.fields[fieldId];
    }
    return lockEditField(fieldId, container, values);
  }

  function buildVisibleRequiredAttributeSteps(usedNodes = new Set()) {
    const fixedChemicalValues = FIXED_REQUIRED_ATTRIBUTE_VALUES.highConcernedChemical;
    const fixedOriginValues = FIXED_REQUIRED_ATTRIBUTE_VALUES.origin;
    const applicationScenarioRule = VISIBLE_REQUIRED_ATTRIBUTE_RULES[6];
    const themeRule = VISIBLE_REQUIRED_ATTRIBUTE_RULES[7];
    return [
      {
        id: 'brand',
        find: () => findBestAttributeContainerForRule(findVisibleAttributeContainers(), VISIBLE_REQUIRED_ATTRIBUTE_RULES[0], usedNodes, { requireRequiredStar: true }),
        values: VISIBLE_REQUIRED_ATTRIBUTE_RULES[0].values,
        mode: 'verify-or-select',
      },
      {
        id: 'frame_material',
        find: () => findDirectRequiredAttributeContainer('frame_material', { requireRequiredStar: true }),
        values: getVisibleFrameMaterialCandidateValues(),
        mode: 'fixed-click',
        confirmWithKeyboard: true,
        prefilterFirstValue: true,
        requireCommittedOption: true,
        allowSafeVisibleOptionFallback: true,
        safeFallbackKind: 'frame_material',
        optionalIfMissing: true,
      },
      {
        id: 'use',
        find: () => findDirectRequiredAttributeContainer('use', { requireRequiredStar: true })
          || findBestAttributeContainerForRule(findVisibleAttributeContainers(), VISIBLE_REQUIRED_ATTRIBUTE_RULES[4], usedNodes, { requireRequiredStar: true }),
        values: getVisibleUseCandidateValues(),
        mode: 'fixed-click',
        confirmWithKeyboard: false,
        skipKeyboardCommit: true,
        noKeyboardCommitForDynamicAttributes: true,
        prefilterFirstValue: true,
        requireCommittedOption: true,
        allowSafeVisibleOptionFallback: true,
        safeFallbackKind: 'use',
        optionalIfMissing: true,
      },
      {
        id: 'function',
        find: () => findDirectRequiredAttributeContainer('function', { requireRequiredStar: true }),
        values: getVisibleFunctionCandidateValues(),
        mode: 'fixed-click',
        confirmWithKeyboard: false,
        skipKeyboardCommit: true,
        noKeyboardCommitForDynamicAttributes: true,
        prefilterFirstValue: true,
        requireCommittedOption: true,
        allowSafeVisibleOptionFallback: true,
        safeFallbackKind: 'function',
        optionalIfMissing: true,
      },
      {
        id: 'feature',
        find: () => findBestAttributeContainerForRule(findVisibleAttributeContainers(), VISIBLE_REQUIRED_ATTRIBUTE_RULES[3], usedNodes, { requireRequiredStar: true }),
        values: getVisibleFeatureCandidateValues(),
        mode: 'fixed-click',
        confirmWithKeyboard: false,
        skipKeyboardCommit: true,
        noKeyboardCommitForDynamicAttributes: true,
        requireCommittedOption: true,
        allowSafeVisibleOptionFallback: true,
        safeFallbackKind: 'feature',
        optionalIfMissing: true,
      },
      {
        id: 'high_concerned_chemical',
        find: () => findDirectRequiredAttributeContainer('high_concerned_chemical', { requireRequiredStar: true }),
        values: fixedChemicalValues,
        mode: 'fixed-click',
        confirmWithKeyboard: true,
        hoverKeyboardOnly: true,
        prefilterFirstValue: true,
        requireCommittedOption: true,
        multiSelectExact: true,
      },
      {
        id: 'origin',
        find: () => findDirectRequiredAttributeContainer('origin', { requireRequiredStar: true }),
        values: fixedOriginValues,
        mode: 'fixed-click',
        confirmWithKeyboard: true,
        prefilterFirstValue: true,
        requireCommittedOption: true,
      },
      {
        id: 'material',
        find: () => findDirectRequiredAttributeContainer('material', { requireRequiredStar: true }),
        values: getVisibleMaterialCandidateValues(),
        mode: 'fixed-click',
        confirmWithKeyboard: false,
        skipKeyboardCommit: true,
        noKeyboardCommitForDynamicAttributes: true,
        prefilterFirstValue: true,
        requireCommittedOption: true,
        allowSafeVisibleOptionFallback: true,
        safeFallbackKind: 'material',
        optionalIfMissing: true,
      },
      {
        id: 'product_application_scenarios',
        find: () => findBestAttributeContainerForRule(findVisibleAttributeContainers(), applicationScenarioRule, usedNodes, { requireRequiredStar: true }),
        values: getVisibleApplicationScenarioCandidateValues(),
        mode: 'fixed-click',
        confirmWithKeyboard: false,
        skipKeyboardCommit: true,
        noKeyboardCommitForDynamicAttributes: true,
        requireCommittedOption: true,
        allowSafeVisibleOptionFallback: true,
        safeFallbackKind: 'product_application_scenarios',
        allowMultipleCheckboxes: true,
        optionalIfMissing: true,
      },
      {
        id: 'theme',
        find: () => findBestAttributeContainerForRule(findVisibleAttributeContainers(), themeRule, usedNodes, { requireRequiredStar: true }),
        values: getVisibleThemeCandidateValues(),
        mode: 'fixed-click',
        confirmWithKeyboard: false,
        skipKeyboardCommit: true,
        noKeyboardCommitForDynamicAttributes: true,
        requireCommittedOption: true,
        allowSafeVisibleOptionFallback: true,
        safeFallbackKind: 'theme',
        optionalIfMissing: true,
      },
    ];
  }

  async function runSingleRequiredAttributeStep(fieldId, options = {}) {
    const deadlineAt = getDeadlineAt(options);
    const usedNodes = new Set();
    const steps = buildVisibleRequiredAttributeSteps(usedNodes);
    const aliases = {
      chemical: 'high_concerned_chemical',
      highConcernedChemical: 'high_concerned_chemical',
      high_concerned: 'high_concerned_chemical',
      application_scenarios: 'product_application_scenarios',
      product_application: 'product_application_scenarios',
      productApplicationScenarios: 'product_application_scenarios',
      shipsFrom: 'ships_from',
      ships_from: 'ships_from',
    };
    const normalizedId = aliases[fieldId] || fieldId;
    const fieldDeadlineAt = deadlineAt || makeDeadlineAt(getRequiredAttributeFieldTimeoutMs(options, 8000));
    if (isDeadlineExceeded(fieldDeadlineAt)) {
      return buildStageTimeoutResult(`required-attributes.${normalizedId}`, fieldDeadlineAt, { id: normalizedId, changed: false, locked: false, reason: 'required attribute stage timeout before start' });
    }
    if (normalizedId === 'ships_from') {
      const before = getVisibleShipsFromStatus();
      const result = before.ok ? { changed: false, ok: true, selectedText: before.selectedText, mode: 'already-selected' } : selectVisibleShipsFromUnitedStates();
      const after = getVisibleShipsFromStatus();
      return { id: normalizedId, before, result, after, ok: after.ok, changed: Boolean(result.changed) };
    }
    const step = steps.find((item) => item.id === normalizedId);
    if (!step) return { id: normalizedId, ok: false, changed: false, reason: 'unsupported required attribute field' };

    let expand = null;
    if (step.id === 'material' || options.expand === true) {
      expand = await ensureRequiredAttributeExpanded(step.id);
    }
    if (isDeadlineExceeded(fieldDeadlineAt)) {
      return buildStageTimeoutResult(`required-attributes.${step.id}`, fieldDeadlineAt, { id: step.id, changed: Boolean(expand && expand.expanded), locked: false, expand, reason: 'required attribute stage timeout after expand' });
    }
    const item = step.find();
    if (!item) {
      if (step.optionalIfMissing) {
        return { id: step.id, changed: Boolean(expand && expand.expanded), ok: true, skipped: true, locked: false, reason: 'field not visible for this category', expand };
      }
      return { id: step.id, changed: Boolean(expand && expand.expanded), ok: false, locked: false, reason: 'locked field container not found', expand };
    }

    const beforeState = verifySelectContainerValue(item.node, step.values, {
      requireCommittedOption: step.requireCommittedOption,
    });
    if (beforeState.ok && step.id !== 'material') {
      return {
        id: step.id,
        expand,
        changed: false,
        ok: true,
        locked: true,
        selectedText: beforeState.okText,
        mode: 'already-selected-readback',
        state: beforeState,
      };
    }

    const result = await runRequiredAttributeSelectionWithHardTimeout(step.id, fieldDeadlineAt, async () => {
      if (step.id === 'high_concerned_chemical') {
        const fastFixedResult = await selectFixedHighConcernedChemicalValue(item.node, step.values, fieldDeadlineAt);
        if (fastFixedResult.ok || fastFixedResult.timedOut || isDeadlineExceeded(fieldDeadlineAt)) {
          return fastFixedResult;
        }
        const fallbackResult = await selectAntMultipleExactValue(item.node, step.values, {
          deadlineAt: fieldDeadlineAt,
          timeoutStage: step.id,
          fieldId: step.id,
          allowValidationIssue: true,
        });
        return { ...fallbackResult, fastFixedResult };
      }
      if (step.multiSelectExact) {
        return selectAntMultipleExactValue(item.node, step.values, {
          deadlineAt: fieldDeadlineAt,
          timeoutStage: step.id,
          fieldId: step.id,
          allowValidationIssue: true,
        });
      }
      if (step.mode === 'fixed-click') {
        if (step.id === 'material') {
          return selectRequiredMaterialAttributeValue(item, step, fieldDeadlineAt);
        }
        return selectRequiredAttributeStepValue(item, step, fieldDeadlineAt);
      }
      return selectAttributeContainerValue(item.node, step.values);
    });
    const acceptedValues = (result.acceptedValues && result.acceptedValues.length) ? result.acceptedValues : step.values;
    let finalResult = result;
    if (
      !result.ok
      && result.state
      && result.state.hasCommittedOption
      && selectedTextMatchesCandidateValues(result.state.okText, acceptedValues)
      && /\u8bf7\u9009\u62e9\u4ea7\u54c1\u5c5e\u6027/.test(String(result.state.validationIssue || ''))
    ) {
      finalResult = {
        ...result,
        ok: true,
        locked: true,
        fieldAcceptedDespiteGlobalNativeError: true,
        reason: 'field has committed option; global native product attribute error is checked by final preflight',
      };
    }
    if (finalResult.ok) {
      lockRequiredAttributeField(step.id, item.node, acceptedValues, finalResult);
    }
    return { id: step.id, expand, ...finalResult, values: acceptedValues, lock: editFieldLocks.fields[step.id] || null };
  }

  async function runLockedRequiredAttributePipeline(options = {}) {
    const deadlineAt = getDeadlineAt(options);
    const usedNodes = new Set();
    const skipFieldIds = new Set(Array.isArray(options.skipFieldIds) ? options.skipFieldIds : []);
    const fieldTimeoutMs = getRequiredAttributeFieldTimeoutMs(options, 8000);
    for (const fieldId of skipFieldIds) {
      const skippedItem = findDirectRequiredAttributeContainer(fieldId);
      if (skippedItem && skippedItem.node) usedNodes.add(skippedItem.node);
    }
    const steps = buildVisibleRequiredAttributeSteps(usedNodes)
      .filter((step) => !skipFieldIds.has(step.id));
    const results = [];
    const locked = new Set();
    for (const step of steps) {
      const fieldDeadlineAt = deadlineAt || makeDeadlineAt(fieldTimeoutMs);
      if (isDeadlineExceeded(deadlineAt)) {
        return {
          changed: results.some((result) => result.changed),
          ok: false,
          timedOut: true,
          locked: Array.from(locked),
          stoppedAt: step.id,
          reason: `stage timeout: ${step.id}`,
          results,
        };
      }
      let expand = null;
      if (step.id === 'material') {
        expand = await ensureRequiredAttributeExpanded('material');
      }
      if (isDeadlineExceeded(fieldDeadlineAt)) {
        results.push(buildStageTimeoutResult(`required-attributes.${step.id}`, fieldDeadlineAt, { id: step.id, changed: Boolean(expand && expand.expanded), expand, reason: 'required attribute stage timeout after expand' }));
        return { changed: results.some((result) => result.changed), ok: false, timedOut: true, locked: Array.from(locked), stoppedAt: step.id, reason: `stage timeout: ${step.id}`, results };
      }
      const item = step.find();
      if (!item) {
        if (step.optionalIfMissing) {
          results.push({ id: step.id, changed: Boolean(expand && expand.expanded), ok: true, skipped: true, locked: false, reason: 'field not visible for this category', expand });
          continue;
        }
        const missing = { id: step.id, changed: Boolean(expand && expand.expanded), ok: false, locked: false, reason: 'locked field container not found', expand };
        results.push(missing);
        return { changed: results.some((result) => result.changed), ok: false, locked: Array.from(locked), stoppedAt: step.id, results };
      }
      const beforeState = verifySelectContainerValue(item.node, step.values, {
        requireCommittedOption: step.requireCommittedOption,
      });
      if (beforeState.ok && step.id !== 'material') {
        locked.add(step.id);
        usedNodes.add(item.node);
        results.push({
          id: step.id,
          expand,
          changed: false,
          ok: true,
          locked: true,
          selectedText: beforeState.okText,
          mode: 'already-selected-readback',
          state: beforeState,
        });
        continue;
      }
      let result = await runRequiredAttributeSelectionWithHardTimeout(step.id, fieldDeadlineAt, async () => {
        if (step.multiSelectExact) {
          return selectAntMultipleExactValue(item.node, step.values, {
            deadlineAt: fieldDeadlineAt,
            timeoutStage: step.id,
            fieldId: step.id,
            allowValidationIssue: true,
          });
        }
        if (step.mode === 'fixed-click') {
          if (step.id === 'material') {
            return selectRequiredMaterialAttributeValue(item, step, fieldDeadlineAt);
          }
          return selectRequiredAttributeStepValue(item, step, fieldDeadlineAt);
        }
        return selectAttributeContainerValue(item.node, step.values);
      });
      if (
        !result.ok
        && result.state
        && result.state.hasCommittedOption
        && selectedTextMatchesCandidateValues(result.state.okText, (result.acceptedValues && result.acceptedValues.length) ? result.acceptedValues : step.values)
        && /\u8bf7\u9009\u62e9\u4ea7\u54c1\u5c5e\u6027/.test(String(result.state.validationIssue || ''))
      ) {
        result = {
          ...result,
          ok: true,
          locked: true,
          fieldAcceptedDespiteGlobalNativeError: true,
          reason: 'field has committed option; global native product attribute error is checked by final preflight',
        };
      }
      results.push({ id: step.id, expand, ...result });
      if (!result.ok) {
        return { changed: results.some((entry) => entry.changed), ok: false, timedOut: Boolean(result.timedOut), locked: Array.from(locked), stoppedAt: step.id, reason: result.reason, results };
      }
      lockRequiredAttributeField(step.id, item.node, (result.acceptedValues && result.acceptedValues.length) ? result.acceptedValues : step.values, result);
      locked.add(step.id);
      if (result.acceptedValues && result.acceptedValues.length) step.values = result.acceptedValues;
      usedNodes.add(item.node);
    }
    const unknownRequired = await fillUnknownRequiredAttributeFallbackFields(findVisibleAttributeContainers(), usedNodes);
    const unknownFailed = unknownRequired.filter((entry) => entry.ok === false);
    return {
      changed: results.some((entry) => entry.changed) || unknownRequired.some((entry) => entry.changed),
      ok: unknownFailed.length === 0,
      locked: Array.from(locked),
      results,
      unknownRequired,
      stoppedAt: unknownFailed[0] ? 'unknown_required_other' : undefined,
    };
  }

  function findVisibleOptionByCandidateValues(values, opener = null) {
    const visibleDropdowns = opener ? getActiveSelectDropdowns(opener) : getVisibleSelectDropdowns();
    const roots = visibleDropdowns.length ? visibleDropdowns : [document];
    return findVisibleOptionByCandidateValuesInRoots(values, roots);
  }

  function findVisibleOptionByCandidateValuesInRoots(values, roots = []) {
    const normalizedValues = values.map((value) => normalizeSelectMatchText(value)).filter(Boolean);
    for (const root of roots) {
      if (!root) continue;
      const optionNodes = Array.from(root.querySelectorAll(
        '.ant-select-item-option,.ant-select-dropdown-menu-item,.select2-results__option,[role="option"],li'
      ));
      const contentNodes = Array.from(root.querySelectorAll('.ant-select-item-option-content,.select2-results__option')).map((node) => (
        node.closest('.ant-select-item-option,.ant-select-dropdown-menu-item,.select2-results__option,[role="option"],li') || node
      ));
      const options = Array.from(new Set(optionNodes.concat(contentNodes)))
        .filter(visibleElement)
        .map((node) => ({ node, text: elementText(node) }))
        .filter((item) => item.text && item.text.length < 220);
      for (const value of normalizedValues) {
        const found = options.find((item) => {
          const text = normalizeSelectMatchText(item.text);
          return text === value || text.includes(value) || value.includes(text);
        });
        if (found) return { option: found.node.closest('.ant-select-item-option,.ant-select-dropdown-menu-item,.select2-results__option,[role="option"]') || found.node, optionText: found.text };
      }
    }
    return null;
  }

  async function findVisibleOptionByCandidateValuesWithScroll(values, opener = null, options = {}) {
    const deadlineAt = getDeadlineAt(options);
    let option = findVisibleOptionByCandidateValues(values, opener);
    if (option) return option;
    if (isDeadlineExceeded(deadlineAt)) return null;
    const holders = getActiveSelectScrollContainers(opener);
    for (const holder of holders) {
      if (isDeadlineExceeded(deadlineAt)) return null;
      const maxScroll = Math.max(0, holder.scrollHeight - holder.clientHeight);
      const stepSize = Math.max(120, Math.floor(holder.clientHeight * 0.8) || 160);
      for (let top = 0; top <= maxScroll + stepSize; top += stepSize) {
        if (isDeadlineExceeded(deadlineAt)) return null;
        holder.scrollTop = Math.min(top, maxScroll);
        holder.dispatchEvent(new Event('scroll', { bubbles: true }));
        await sleep(90);
        if (isDeadlineExceeded(deadlineAt)) return null;
        option = findVisibleOptionByCandidateValues(values, opener);
        if (option) return option;
      }
    }
    return null;
  }

  function selectedTextMatchesCandidateValues(selectedText, values) {
    const selected = normalizeSelectMatchText(selectedText);
    if (!selected) return false;
    return values.some((value) => {
      const wanted = normalizeSelectMatchText(value);
      return wanted && (selected === wanted || selected.includes(wanted) || wanted.includes(selected));
    });
  }

  function isUnknownRequiredAttributeContainer(candidate) {
    const text = String((candidate && candidate.text) || '');
    if (!/\*/.test(text)) return false;
    if (/\u4ea7\u54c1\u5206\u7c7b|\u5e97\u94fa\u540d\u79f0|\u8fd0\u8d39\u6a21\u677f|\u53d1\u8d27\u5730|\u4ea7\u54c1\u6807\u9898|SKU|\u8d27\u503c|\u7269\u6d41\u8d39|\u5e93\u5b58|\u91cd\u91cf|\u5c3a\u5bf8|category|shop|postage|freight|ship|title|sku|price|stock|weight|size/i.test(text)) return false;
    if (!candidate.node || !candidate.node.querySelector('.ant-select,input[role="combobox"],input[type="search"],input[type="checkbox"],input[type="radio"]')) return false;
    const selectedText = firstNonEmpty(getSelectedTextInContainer(candidate.node), getCheckedTextsInContainer(candidate.node).join(' '), '');
    return isBlankSelectionText(selectedText);
  }

  async function fillUnknownRequiredAttributeFallbackFields(containers, usedNodes) {
    const results = [];
    for (const item of containers) {
      if (nodeOverlapsAnyUsed(item.node, usedNodes) || !isUnknownRequiredAttributeContainer(item)) continue;
      const labelText = item.text.slice(0, 120);
      const fallbackKind = /\u7528\u9014|^use$|\(use\)/i.test(labelText)
        ? 'use'
        : /\u4ea7\u54c1\u9002\u7528\u573a\u666f|product application scenarios?/i.test(labelText)
          ? 'product_application_scenarios'
          : /\u4e3b\u9898|theme/i.test(labelText)
            ? 'theme'
            : /\u6750\u8d28|material/i.test(labelText)
              ? 'material'
        : /\u7279\u6027|\u7279\u70b9|feature/i.test(labelText)
          ? 'feature'
          : /\u529f\u80fd|function/i.test(labelText)
            ? 'function'
            : 'generic';
      const fallbackValues = fallbackKind === 'feature'
        ? getVisibleFeatureCandidateValues(labelText)
        : fallbackKind === 'product_application_scenarios'
          ? getVisibleApplicationScenarioCandidateValues()
          : fallbackKind === 'theme'
            ? getVisibleThemeCandidateValues()
            : fallbackKind === 'material'
              ? getVisibleMaterialCandidateValues()
        : ['\u5176\u4ed6(Other)', 'Other', '\u5176\u4ed6'];
      let result = await selectRequiredAttributeCheckboxValue(item.node, fallbackValues, {
        allowMultipleCheckboxes: fallbackKind === 'product_application_scenarios',
        safeFallbackKind: fallbackKind,
      });
      if (!result.handled) {
        result = await selectLockedDropdownOption(item.node, fallbackValues, {
          confirmWithKeyboard: false,
          skipKeyboardCommit: true,
          noKeyboardCommitForDynamicAttributes: /^(?:function|use|feature|product_application_scenarios|theme)$/i.test(fallbackKind),
          requireCommittedOption: true,
          allowSafeVisibleOptionFallback: true,
          safeFallbackKind: fallbackKind,
        });
      }
      results.push({
        id: 'unknown_required_other',
        labelText,
        ...result,
      });
      if (result.ok) usedNodes.add(item.node);
    }
    return results;
  }

  function getRequiredAttributeFieldTimeoutMs(options = {}, fallback = 8000) {
    const value = Number(options.fieldTimeoutMs || options.requiredAttributeFieldTimeoutMs || options.requiredFieldTimeoutMs || fallback || 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  async function runRequiredAttributeSelectionWithHardTimeout(fieldId, deadlineAt, task) {
    if (!deadlineAt) return task();
    const stageId = `required-attributes.${fieldId}`;
    const remainingMs = Math.max(0, deadlineAt - Date.now());
    if (!remainingMs) {
      return buildStageTimeoutResult(stageId, deadlineAt, {
        id: fieldId,
        changed: false,
        locked: false,
        reason: `required attribute field timeout before selection: ${fieldId}`,
      });
    }
    let timer = null;
    let hardTimedOut = false;
    try {
      const result = await Promise.race([
        Promise.resolve().then(task),
        new Promise((resolve) => {
          timer = window.setTimeout(() => {
            hardTimedOut = true;
            resolve(buildStageTimeoutResult(stageId, deadlineAt, {
              id: fieldId,
              changed: false,
              locked: false,
              reason: `required attribute field hard timeout: ${fieldId}`,
            }));
          }, remainingMs + 500);
        }),
      ]);
      if (hardTimedOut || (result && result.timedOut)) {
        try {
          await closeVisibleSelectDropdowns();
        } catch (_) {
          // Timeout recovery should never hide the field-level result.
        }
      }
      return result;
    } finally {
      if (timer) window.clearTimeout(timer);
    }
  }

  async function selectAttributeContainerValue(container, values, options = {}) {
    const selectedText = getSelectedTextInContainer(container);
    if (!isBlankSelectionText(selectedText) && selectedTextMatchesCandidateValues(selectedText, values)) {
      return { changed: false, ok: true, selectedText, mode: 'already-selected' };
    }
    if (!isBlankSelectionText(selectedText) && options.keepNonBlank) {
      return { changed: false, ok: true, selectedText, mode: 'already-selected-nonblank' };
    }
    const checkboxes = Array.from(container.querySelectorAll('input[type="checkbox"]')).filter((node) => !node.closest(`#${PANEL_ID}`));
    if (checkboxes.length) {
      const checkedText = checkboxes.filter((node) => node.checked).map((node) => checkboxNearbyText(node)).join(' ');
      if (selectedTextMatchesCandidateValues(checkedText, values)) {
        return { changed: false, ok: true, selectedText: checkedText, mode: 'already-checked' };
      }
      for (const value of values) {
        const wanted = normalizeCategoryText(value);
        const box = checkboxes.find((node) => {
          const text = normalizeCategoryText(checkboxNearbyText(node));
          return wanted && (text.includes(wanted) || wanted.includes(text));
        });
        if (box) {
          const changed = setCheckboxChecked(box, true);
          await sleep(250);
          return { changed, ok: Boolean(box.checked), selectedText: checkboxNearbyText(box), mode: 'checkbox' };
        }
      }
    }
    const result = await selectAntLikeValue(container, values, { maxAttempts: 3 });
    if (result.ok) return result;
    return { ...result, reason: result.reason || 'attribute value not selected', values };
  }

  async function fillVisibleRequiredAttributeFields(options = {}) {
    return runLockedRequiredAttributePipeline(options);
  }

  function findVisibleShipFromSection() {
    const nodes = Array.from(document.querySelectorAll('.ant-form-item,.form-group,.row,section,div,td,tr'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node))
      .map((node) => ({ node, text: elementText(node), rect: node.getBoundingClientRect() }))
      .filter((item) => /\u53d1\u8d27\u5730|ships?\s*from/i.test(item.text) && /united states|\u7f8e\u56fd/i.test(item.text) && item.text.length < 1800)
      .sort((a, b) => a.text.length - b.text.length || a.rect.top - b.rect.top);
    return nodes[0] ? nodes[0].node : null;
  }

  function checkboxNearbyText(input) {
    if (!input) return '';
    const label = input.closest('label');
    if (label) return elementText(label);
    const parent = input.parentElement;
    const siblingText = [input.nextSibling, parent && parent.nextSibling]
      .map((node) => String((node && (node.innerText || node.textContent)) || ''))
      .join(' ');
    return normalizeSpaces(`${elementText(parent)} ${siblingText}`);
  }

  function setCheckboxChecked(input, checked) {
    if (!input) return false;
    if (Boolean(input.checked) === Boolean(checked)) return false;
    const label = input.closest('label') || input.parentElement;
    if (label) {
      callReactHandler(label, 'onMouseDown', input);
      callReactHandler(label, 'onClick', input);
    }
    callReactHandler(input, 'onMouseDown', input);
    callReactHandler(input, 'onClick', input);
    clickElement(label || input);
    if (Boolean(input.checked) === Boolean(checked)) {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'checked');
    if (descriptor && descriptor.set) descriptor.set.call(input, Boolean(checked));
    else input.checked = Boolean(checked);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    return Boolean(input.checked) === Boolean(checked);
  }

  function getVisibleShipsFromStatus() {
    const section = findVisibleShipFromSection();
    if (!section) return { ok: false, reason: 'ships from section not found' };
    const sectionText = elementText(section);
    const checkboxes = Array.from(section.querySelectorAll('input[type="checkbox"]'))
      .filter((node) => !node.closest(`#${PANEL_ID}`));
    const isUs = (node) => /united states|\u7f8e\u56fd/i.test(checkboxNearbyText(node));
    const usCheckbox = checkboxes.find(isUs);
    const checkedBoxes = checkboxes.filter((node) => node.checked);
    const checkedTexts = checkedBoxes.map((node) => checkboxNearbyText(node)).filter(Boolean);
    const nonUsChecked = checkedBoxes.filter((node) => !isUs(node));
    const visibleUnitedStates = /united states|\u7f8e\u56fd/i.test(sectionText);
    return {
      ok: checkboxes.length
        ? Boolean(usCheckbox && usCheckbox.checked && nonUsChecked.length === 0)
        : Boolean(visibleUnitedStates),
      hasSection: true,
      hasCheckboxes: checkboxes.length > 0,
      hasUnitedStates: Boolean(usCheckbox || visibleUnitedStates),
      checkedTexts,
      badCheckedTexts: nonUsChecked.map((node) => checkboxNearbyText(node)).filter(Boolean),
      selectedText: usCheckbox ? checkboxNearbyText(usCheckbox) : (visibleUnitedStates ? sectionText.slice(0, 180) : ''),
    };
  }

  function selectVisibleShipsFromUnitedStates() {
    const section = findVisibleShipFromSection();
    if (!section) return { changed: false, ok: false, reason: 'ships from section not found' };
    const checkboxes = Array.from(section.querySelectorAll('input[type="checkbox"]'))
      .filter((node) => !node.closest(`#${PANEL_ID}`));
    const isUs = (node) => /united states|\u7f8e\u56fd/i.test(checkboxNearbyText(node));
    const usCheckbox = checkboxes.find(isUs);
    if (!usCheckbox) return { changed: false, ok: false, reason: 'United States checkbox not found' };
    let changed = false;
    for (const box of checkboxes) {
      changed = setCheckboxChecked(box, box === usCheckbox) || changed;
    }
    const status = getVisibleShipsFromStatus();
    return {
      changed,
      ok: status.ok,
      selectedText: status.selectedText || checkboxNearbyText(usCheckbox),
      checkedTexts: status.checkedTexts || [],
      badCheckedTexts: status.badCheckedTexts || [],
      mode: 'only-united-states',
    };
  }

  function findCustomAttributeSection() {
    const label = '\u81ea\u5b9a\u4e49\u5c5e\u6027';
    const scope = getEditFormScope();
    const nodes = Array.from(scope.querySelectorAll('.ant-form-item,.form-group,.row,table,tbody,section,div'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node))
      .filter((node) => elementText(node).includes(label) && node.querySelector('input,button,a,span'));
    const ranked = nodes
      .map((node) => ({ node, text: elementText(node), rect: node.getBoundingClientRect() }))
      .filter((item) => item.text.length < 1600)
      .sort((a, b) => a.text.length - b.text.length || a.rect.top - b.rect.top);
    if (ranked[0]) return ranked[0].node;
    const fallback = nodes
      .map((node) => ({ node, text: elementText(node), rect: node.getBoundingClientRect() }))
      .filter((item) => item.text.length < 6000)
      .sort((a, b) => a.rect.width * a.rect.height - b.rect.width * b.rect.height || a.text.length - b.text.length);
    return fallback[0] ? fallback[0].node : null;
  }

  function getCustomAttributeInputs(section) {
    const scoped = section ? Array.from(section.querySelectorAll('input[type="text"],textarea')) : [];
    const scope = getEditFormScope();
    const visibleCustomInputs = Array.from(scope.querySelectorAll('input[type="text"],textarea'))
      .filter((node) => /属性名|属性值/i.test(String(node.getAttribute('placeholder') || '')));
    return Array.from(new Set([...scoped, ...visibleCustomInputs]))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && node.type !== 'hidden' && visibleElement(node));
  }

  function getCustomAttributeRows(section) {
    const inputs = getCustomAttributeInputs(section)
      .filter((node) => /属性名|属性值/i.test(String(node.getAttribute('placeholder') || '')));
    const rows = [];
    for (const input of inputs) {
      let cursor = input.parentElement;
      for (let depth = 0; cursor && depth < 6; depth += 1, cursor = cursor.parentElement) {
        const placeholders = Array.from(cursor.querySelectorAll('input[type="text"],textarea'))
          .map((node) => String(node.getAttribute('placeholder') || ''));
        if (placeholders.some((value) => /属性名/i.test(value)) && placeholders.some((value) => /属性值/i.test(value))) {
          rows.push(cursor);
          break;
        }
      }
    }
    return Array.from(new Set(rows)).filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node));
  }

  function findCustomAttributeDeleteControls(section) {
    return getCustomAttributeRows(section)
      .flatMap((row) => Array.from(row.querySelectorAll('button,a,span,i,.iconfont')))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node))
      .filter((node) => /icon_close|icon-delete|delete|remove|close|minus|trash/i.test(String(node.className || '') + ' ' + String(node.getAttribute('title') || '') + ' ' + String(node.getAttribute('aria-label') || '')));
  }

  async function waitForCustomAttributeRowCountBelow(section, beforeCount, timeoutMs = 1200) {
    const start = Date.now();
    let rows = getCustomAttributeRows(section);
    while (Date.now() - start < timeoutMs) {
      if (rows.length < beforeCount || !rows.some((row) => document.documentElement.contains(row))) return rows;
      await sleep(120);
      rows = getCustomAttributeRows(section);
    }
    return rows;
  }

  function normalizeCustomAttributeText(value) {
    const sanitized = normalizeSpaces(sanitizePlatformText(value));
    if (sanitized.length <= EDIT_PAGE_RULES.customAttributeMaxChars) return sanitized;
    return sanitized.slice(0, EDIT_PAGE_RULES.customAttributeMaxChars).trim();
  }

  function getVisibleCustomAttributeValues() {
    const section = findCustomAttributeSection();
    if (!section) return { section: null, values: [] };
    const values = getCustomAttributeInputs(section)
      .map((node) => getInputText(node))
      .filter((value) => String(value || '').trim() !== '');
    return { section, values };
  }

  function getVisibleCustomAttributeStatus() {
    const current = getVisibleCustomAttributeValues();
    const rows = getCustomAttributeRows(current.section);
    const rowErrors = rows
      .map((row, index) => ({ index, text: elementText(row) }))
      .filter((item) => /\u4e0d\u80fd\u8d85\u8fc7|\u4e0d\u80fd\u4e3a\u7a7a|required|too long/i.test(item.text));
    const invalid = current.values
      .map((value, index) => ({
        index,
        value,
        length: String(value || '').length,
        issues: findPlatformTextIssues(value),
      }))
      .filter((item) => item.length > EDIT_PAGE_RULES.customAttributeMaxChars || item.issues.length);
    return {
      ok: invalid.length === 0 && rowErrors.length === 0,
      section: current.section,
      values: current.values,
      count: current.values.length,
      invalid,
      rowCount: rows.length,
      rowErrors,
    };
  }

  async function clearVisibleCustomAttributes() {
    if (!EDIT_PAGE_RULES.customAttributesDefaultSkip) return { changed: false, skipped: true };
    const current = getVisibleCustomAttributeValues();
    if (!current.section) return { changed: false, ok: true, reason: 'custom attribute section not found' };
    const beforeCount = current.values.length;
    let legalFallback = 0;
    let cleared = 0;
    let clicked = 0;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const rows = getCustomAttributeRows(current.section);
      if (!rows.length) break;
      for (const row of rows.slice().reverse()) {
        const beforeRows = getCustomAttributeRows(current.section).length;
        const control = Array.from(row.querySelectorAll('button,a,span,i,.iconfont'))
          .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node))
          .find((node) => /icon_close|icon-delete|delete|remove|close|minus|trash/i.test(String(node.className || '') + ' ' + String(node.getAttribute('title') || '') + ' ' + String(node.getAttribute('aria-label') || '')));
        if (!control) continue;
        clickElement(control);
        clicked += 1;
        await waitForCustomAttributeRowCountBelow(current.section, beforeRows, 900);
      }
      await sleep(250);
      if (!getCustomAttributeRows(current.section).length) break;
    }
    let after = getVisibleCustomAttributeStatus();
    if (!after.ok) {
      const rows = getCustomAttributeRows(after.section || current.section);
      rows.forEach((row) => {
        const inputs = Array.from(row.querySelectorAll('input[type="text"],textarea')).filter((node) => visibleElement(node));
        if (inputs[0] && setInputValue(inputs[0], 'Material')) legalFallback += 1;
        if (inputs[1] && setInputValue(inputs[1], 'Silicone')) legalFallback += 1;
        inputs.slice(2).forEach((node) => {
          if (getInputText(node) && setInputValue(node, '')) cleared += 1;
        });
      });
      await sleep(300);
      after = getVisibleCustomAttributeStatus();
    }
    return {
      changed: clicked > 0 || cleared > 0 || legalFallback > 0,
      ok: after.ok && after.rowErrors.length === 0,
      beforeCount,
      afterCount: after.count,
      invalidCount: after.invalid.length,
      rowCount: after.rowCount,
      rowErrors: after.rowErrors,
      clicked,
      cleared,
      legalFallback,
    };
  }

  function getVisiblePcDescriptionChars() {
    const target = findVisiblePcDescriptionTarget();
    if (!target) return 0;
    const text = target.type === 'iframe' || target.type === 'contenteditable'
      ? String(target.node.innerText || target.node.textContent || '')
      : getInputText(target.node).replace(/<[^>]+>/g, ' ');
    return text.replace(/\s+/g, ' ').trim().length;
  }

  function getVisiblePcDescriptionHtml() {
    const target = findVisiblePcDescriptionTarget();
    if (!target) return '';
    if (target.type === 'iframe' || target.type === 'contenteditable') return String(target.node.innerHTML || '');
    return getInputText(target.node);
  }

  function getVisiblePcDescriptionImageStatus() {
    const html = getVisiblePcDescriptionHtml();
    const sourceImages = selectPcDetailImages(getCurrentEditMainImageUrls());
    const detailImageState = analyzePcDetailWebImages(html, sourceImages);
    const ok = sourceImages.length >= EDIT_PAGE_RULES.pcDescriptionMinImages
      && detailImageState.currentProductImageCount >= EDIT_PAGE_RULES.pcDescriptionMinImages
      && detailImageState.leadingImageCount >= EDIT_PAGE_RULES.pcDescriptionMinImages;
    return {
      ok,
      sourceImageCount: sourceImages.length,
      ...detailImageState,
    };
  }

  async function waitForVisiblePcDescriptionImageStatus(timeoutMs = 5000, pollMs = 300) {
    const startedAt = Date.now();
    let status = getVisiblePcDescriptionImageStatus();
    while (!status.ok && Date.now() - startedAt < timeoutMs) {
      await sleep(pollMs);
      status = getVisiblePcDescriptionImageStatus();
    }
    return { ...status, waitedMs: Date.now() - startedAt };
  }

  function verifyEditTemplateSelections() {
    const postageContainer = findPostageTemplateContainer() || document.body;
    const postageSelectedText = getCommittedPostageTemplateText(postageContainer);
    const category = getProductCategorySelectedText();
    return {
      postage111: isExactPostageTemplate111Text(postageSelectedText),
      postageSelectedText,
      categorySelected: !isBlankSelectionText(category.selectedText),
      categorySelectedText: category.selectedText,
    };
  }

  function hasVisibleNativeValidationText(pattern) {
    const scope = getEditFormScope();
    return Array.from(scope.querySelectorAll('.ant-form-item-explain-error,.ant-form-show-help-item'))
      .filter((node) => {
        if (node.closest(`#${PANEL_ID}`) || !visibleElement(node)) return false;
        const className = String(node.className || '');
        if (/validating|leave|prepare/i.test(className)) return false;
        const style = window.getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        if (!style || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
        return rect.width > 0 && rect.height > 1;
      })
      .some((node) => pattern.test(elementText(node)));
  }

  function getRequiredStarAttributeRows() {
    const scope = getEditFormScope();
    const attrScope = Array.from(scope.querySelectorAll('.required-attrs,.attr-gray-container.product-attrs,.product-attrs'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node))
      .sort((a, b) => elementText(a).length - elementText(b).length)[0] || scope;
    const rows = Array.from(attrScope.querySelectorAll('.ant-form-item,.form-group,.row,tr,td'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node))
      .filter((node) => node.querySelector('.ant-select,input,select,textarea,input[type="checkbox"],input[type="radio"]'))
      .map((node) => {
        const labelNode = node.querySelector('.attr-label,.label-wrapper,.ant-form-item-label,label');
        const labelText = elementText(labelNode).replace(/\s+/g, ' ').trim();
        const text = elementText(node);
        const required = Boolean(
          node.querySelector('.attr-label.required')
          || (labelNode && /\*/.test(elementText(labelNode)))
          || /\*/.test(text.slice(0, 160))
        );
        return { node, labelText: labelText || text.slice(0, 80), text };
      })
      .filter((item) => item.labelText && item.text.length < 900)
      .filter((item) => {
        const text = item.text;
        if (!/\*/.test(text.slice(0, 180)) && !item.node.querySelector('.attr-label.required')) return false;
        if (/\u5e97\u94fa\u540d\u79f0|\u4ea7\u54c1\u5206\u7c7b|\u8fd0\u8d39\u6a21\u677f|\u53d1\u8d27\u5730|SKU|\u8d27\u503c|\u7269\u6d41\u8d39|\u5e93\u5b58|\u91cd\u91cf|\u5c3a\u5bf8|shop|category|postage|freight|ship|sku|price|stock|weight|size/i.test(text)) return false;
        return true;
      });
    const seen = new Set();
    return rows
      .sort((a, b) => a.text.length - b.text.length || a.node.getBoundingClientRect().top - b.node.getBoundingClientRect().top)
      .filter((item) => {
        const key = `${item.labelText}::${Math.round(item.node.getBoundingClientRect().top)}`;
        if (seen.has(key)) return false;
        if (rows.some((other) => other !== item && item.node.contains(other.node) && other.text.length < item.text.length)) return false;
        seen.add(key);
        return true;
      });
  }

  function getRequiredStarAttributeStatus() {
    const rows = getRequiredStarAttributeRows();
    const fields = rows.map((item, index) => {
      const info = getAntSelectValueInfo(item.node);
      const checkedInputs = Array.from(item.node.querySelectorAll('input[type="checkbox"],input[type="radio"]'))
        .filter((node) => !node.closest(`#${PANEL_ID}`) && node.checked);
      const plainInputValue = Array.from(item.node.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]),textarea,select'))
        .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node))
        .filter((node) => !/combobox|search/i.test(String(node.getAttribute('role') || node.type || '')))
        .map((node) => getInputText(node) || elementText(node))
        .find((value) => !isBlankSelectionText(value) && !isUnsafeSelectDisplayText(value));
      const selectedText = firstNonEmpty(
        getSelectedTextInContainer(item.node),
        checkedInputs.map((node) => checkboxNearbyText(node)).filter(Boolean).join(' '),
        plainInputValue,
        info.okText,
        ''
      );
      const hasDropdown = Boolean(item.node.querySelector('.ant-select,input[role="combobox"],input[type="search"]'));
      const hasEffectiveValue = !isBlankSelectionText(selectedText) && !isUnsafeSelectDisplayText(selectedText);
      const committedDynamicRequired = (
        (/\u7528\u9014|use/i.test(item.labelText) && selectedTextMatchesCandidateValues(selectedText, getVisibleUseCandidateValues()))
        || (/\u529f\u80fd|function/i.test(item.labelText) && selectedTextMatchesCandidateValues(selectedText, getVisibleFunctionCandidateValues()))
        || (/\u6846\u67b6\u6750\u8d28|frame\s*material/i.test(item.labelText) && selectedTextMatchesCandidateValues(selectedText, getVisibleFrameMaterialCandidateValues()))
      );
      const ok = hasDropdown
        ? Boolean(hasEffectiveValue && (!getSelectValidationIssue(item.node) || committedDynamicRequired))
        : Boolean(hasEffectiveValue);
      return {
        id: `required_star_${index + 1}`,
        labelText: item.labelText,
        ok,
        selectedText: selectedText || info.okText || '',
      };
    });
    return {
      ok: fields.every((field) => field.ok),
      fields,
      missing: fields.filter((field) => !field.ok).map((field) => field.labelText || field.id),
    };
  }

  function getVisibleRequiredAttributeStatus() {
    const brandRule = VISIBLE_REQUIRED_ATTRIBUTE_RULES[0];
    const containers = findVisibleAttributeContainers();
    const usedNodes = new Set();
    const brandItem = findBestAttributeContainerForRule(containers, brandRule, usedNodes, { requireRequiredStar: true });
    if (brandItem) usedNodes.add(brandItem.node);
    const useRule = VISIBLE_REQUIRED_ATTRIBUTE_RULES[4];
    const useItem = findDirectRequiredAttributeContainer('use', { requireRequiredStar: true })
      || findBestAttributeContainerForRule(containers, useRule, usedNodes, { requireRequiredStar: true });
    if (useItem) usedNodes.add(useItem.node);
    const featureRule = VISIBLE_REQUIRED_ATTRIBUTE_RULES[3];
    const featureItem = findBestAttributeContainerForRule(containers, featureRule, usedNodes, { requireRequiredStar: true });
    if (featureItem) usedNodes.add(featureItem.node);
    const functionItem = findDirectRequiredAttributeContainer('function', { requireRequiredStar: true });
    if (functionItem) usedNodes.add(functionItem.node);
    const applicationScenarioRule = VISIBLE_REQUIRED_ATTRIBUTE_RULES[6];
    const applicationScenarioItem = findBestAttributeContainerForRule(containers, applicationScenarioRule, usedNodes, { requireRequiredStar: true });
    if (applicationScenarioItem) usedNodes.add(applicationScenarioItem.node);
    const themeRule = VISIBLE_REQUIRED_ATTRIBUTE_RULES[7];
    const themeItem = findBestAttributeContainerForRule(containers, themeRule, usedNodes, { requireRequiredStar: true });
    if (themeItem) usedNodes.add(themeItem.node);
    const rules = [
      {
        id: 'brand',
        item: brandItem,
        values: brandRule.values,
      },
      {
        id: 'use',
        item: useItem,
        values: getVisibleUseCandidateValues(),
        acceptCommittedOption: true,
      },
      {
        id: 'function',
        item: functionItem,
        values: getVisibleFunctionCandidateValues(),
        acceptCommittedOption: true,
      },
      {
        id: 'feature',
        item: featureItem,
        values: getVisibleFeatureCandidateValues(),
        acceptCommittedOption: true,
      },
      {
        id: 'high_concerned_chemical',
        item: findDirectRequiredAttributeContainer('high_concerned_chemical', { requireRequiredStar: true }),
        values: FIXED_REQUIRED_ATTRIBUTE_VALUES.highConcernedChemical,
      },
      {
        id: 'origin',
        item: findDirectRequiredAttributeContainer('origin', { requireRequiredStar: true }),
        values: FIXED_REQUIRED_ATTRIBUTE_VALUES.origin,
      },
      {
        id: 'material',
        item: findDirectRequiredAttributeContainer('material', { requireRequiredStar: true }),
        values: getVisibleMaterialCandidateValues(),
        acceptCommittedOption: true,
      },
      {
        id: 'product_application_scenarios',
        item: applicationScenarioItem,
        values: getVisibleApplicationScenarioCandidateValues(),
        acceptCommittedOption: true,
      },
      {
        id: 'theme',
        item: themeItem,
        values: getVisibleThemeCandidateValues(),
        acceptCommittedOption: true,
      },
    ];
    const fields = rules.map((rule) => {
      const item = rule.item;
      if (!item) return { id: rule.id, ok: true, skipped: true, reason: 'locked field container not visible on this category' };
      const selectedText = firstNonEmpty(
        getSelectedTextInContainer(item.node),
        getCheckedTextsInContainer(item.node).join(' '),
        ''
      );
      const hasCommittedOption = !isBlankSelectionText(selectedText) && !isUnsafeSelectDisplayText(selectedText);
      return {
        id: rule.id,
        ok: rule.acceptCommittedOption
          ? hasCommittedOption
          : hasCommittedOption && selectedTextMatchesCandidateValues(selectedText, rule.values),
        selectedText,
      };
    });
    const nativeProductAttributeError = hasVisibleNativeValidationText(/\u8bf7\u9009\u62e9\u4ea7\u54c1\u5c5e\u6027/);
    const starStatus = getRequiredStarAttributeStatus();
    const missing = Array.from(new Set(
      fields.filter((item) => !item.ok).map((item) => item.id)
        .concat(starStatus.missing.map((item) => `red_star:${item}`))
        .concat(nativeProductAttributeError ? ['native_product_attribute_error'] : [])
    ));
    return {
      ok: fields.every((item) => item.ok) && starStatus.ok && !nativeProductAttributeError,
      fields,
      redStarFields: starStatus.fields,
      missing,
    };
  }

  function getUnsafeRequiredAttributeDisplays() {
    return getRequiredStarAttributeRows()
      .map((item) => {
        const info = getAntSelectValueInfo(item.node);
        return {
          labelText: item.text.slice(0, 120),
          selectedText: info.okText,
          unsafe: isUnsafeSelectDisplayText(info.okText),
        };
      })
      .filter((item) => item.unsafe && item.selectedText);
  }

  function getPackageSaleState() {
    const scope = getEditFormScope();
    const nodes = Array.from(scope.querySelectorAll('.ant-form-item,.form-group,.row,div,td,tr,label'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node))
      .map((node) => ({ node, text: elementText(node), rect: node.getBoundingClientRect() }))
      .filter((item) => /\u9500\u552e\u65b9\u5f0f|\u6253\u5305\u51fa\u552e|\u6bcf\u5305/.test(item.text) && item.text.length < 500)
      .sort((a, b) => a.text.length - b.text.length || a.rect.top - b.rect.top);
    const root = nodes[0] ? nodes[0].node : null;
    if (!root) return { visible: false, checked: false, root: null, text: '' };
    const checkbox = Array.from(root.querySelectorAll('input[type="checkbox"]')).find((node) => visibleElement(node) || node.checked)
      || Array.from(scope.querySelectorAll('input[type="checkbox"]')).find((node) => {
        const label = node.closest('label');
        const text = checkboxNearbyText(node) || elementText(label);
        return /\u6253\u5305\u51fa\u552e|\u9500\u552e\u65b9\u5f0f/.test(text);
      });
    return {
      visible: true,
      checked: Boolean(checkbox && checkbox.checked),
      checkbox,
      root,
      text: elementText(root).slice(0, 300),
    };
  }

  function disablePackageSaleIfChecked() {
    const stateInfo = getPackageSaleState();
    if (!stateInfo.checkbox || !stateInfo.checked) {
      return { changed: false, ok: !stateInfo.checked, ...stateInfo };
    }
    const changed = setCheckboxChecked(stateInfo.checkbox, false);
    const after = getPackageSaleState();
    return {
      changed,
      ok: !after.checked,
      beforeChecked: true,
      afterChecked: after.checked,
      text: stateInfo.text,
    };
  }

  function getVisibleEditPreflightStatus() {
    const titleInput = findProductTitleInput();
    const titleText = titleInput ? getInputText(titleInput) : '';
    const customAttributes = getVisibleCustomAttributeStatus();
    const templates = verifyEditTemplateSelections();
    const requiredAttributes = getVisibleRequiredAttributeStatus();
    const shipsFrom = getVisibleShipsFromStatus();
    const price = getVisiblePriceStatus();
    const variationRequiredFields = getVisibleVariationRequiredFieldStatus();
    const unsafeRequiredAttributeDisplays = getUnsafeRequiredAttributeDisplays();
    const packageSale = getPackageSaleState();
    const modalPlan = buildCategoryModalSearchPlan(titleText);
    const categoryEvidence = modalPlan && modalPlan.categoryEvidence
      ? { required: REQUIRE_ALIEXPRESS_CATEGORY_EVIDENCE, ok: true, planId: modalPlan.id, ...modalPlan.categoryEvidence }
      : getAliExpressEvidencePreflightStatus(titleText, templates.categorySelectedText);
    const risks = [];
    if (!titleText || titleText.length > EDIT_PAGE_RULES.titleMaxChars) risks.push(`title invalid length=${titleText.length}`);
    const titleForbiddenTerms = findForbiddenTitleTerms(titleText, getCurrentEditComplianceSource(titleText));
    if (titleForbiddenTerms.length) risks.push(`title contains brand/trademark terms: ${titleForbiddenTerms.join(', ')}`);
    if (REQUIRE_ALIEXPRESS_CATEGORY_EVIDENCE && !categoryEvidence.ok && !modalPlan) {
      risks.push(`AliExpress category evidence required: ${categoryEvidence.reason || 'category_evidence_missing'}`);
    }
    if (!templates.categorySelected) risks.push('product category is not selected');
    if (modalPlan && !categoryTextMatchesModalPlan(templates.categorySelectedText, modalPlan)) risks.push(`product category does not match ${modalPlan.id}: ${templates.categorySelectedText || 'empty'}`);
    if (isDrawerStorageProductText(titleText) && isWrongDrawerStorageCategory(templates.categorySelectedText)) risks.push(`category path is wrong for drawer storage: ${templates.categorySelectedText}`);
    if (!templates.postage111) risks.push(`postage template is not 111: ${templates.postageSelectedText || 'empty'}`);
    if (!requiredAttributes.ok) risks.push(`required attributes incomplete: ${requiredAttributes.missing.join(', ')}`);
    if (unsafeRequiredAttributeDisplays.length) risks.push(`unsafe required attribute display: ${unsafeRequiredAttributeDisplays.map((item) => `${item.labelText}=${item.selectedText}`).join('; ')}`);
    if (packageSale.checked) risks.push('package sale must stay unchecked');
    if (!shipsFrom.ok) risks.push(`ships from is not United States: ${shipsFrom.selectedText || shipsFrom.reason || 'empty'}`);
    if (!price.ok) risks.push(`price invalid: ${price.reason || 'must equal Amazon original price x task formula'}`);
    if (!variationRequiredFields.ok) risks.push(variationRequiredFields.reason || `variation required fields incomplete: ${variationRequiredFields.missing.join(', ')}`);
    if (hasVisibleNativeValidationText(/\u8bf7\u9009\u62e9\u5fc5\u9009\u53d8\u79cd\u5c5e\u6027/)) risks.push('variation parameter blocked: required variation attribute missing');
    const pcDescriptionChars = getVisiblePcDescriptionChars();
    if (pcDescriptionChars < EDIT_PAGE_RULES.pcDescriptionMinChars) risks.push(`PC description too short: ${pcDescriptionChars}`);
    const pcDescriptionImages = getVisiblePcDescriptionImageStatus();
    if (pcDescriptionImages.sourceImageCount < EDIT_PAGE_RULES.pcDescriptionMinImages) {
      risks.push(`PC description source images missing: ${pcDescriptionImages.sourceImageCount}/${EDIT_PAGE_RULES.pcDescriptionMinImages}`);
    } else if (pcDescriptionImages.currentProductImageCount < EDIT_PAGE_RULES.pcDescriptionMinImages) {
      risks.push(`PC description missing current product images: ${pcDescriptionImages.currentProductImageCount}/${EDIT_PAGE_RULES.pcDescriptionMinImages}`);
    }
    if (pcDescriptionImages.leadingImageCount < EDIT_PAGE_RULES.pcDescriptionMinImages) {
      risks.push(`PC description image-first layout missing: ${pcDescriptionImages.leadingImageCount}/${EDIT_PAGE_RULES.pcDescriptionMinImages}`);
    }
    const marketingImages = getMarketingImageStatus();
    if (!marketingImages.ready) {
      risks.push(`marketing images incomplete: ${marketingImages.count}/${EDIT_PAGE_RULES.marketingImageCount}`);
    }
    if (!customAttributes.ok) {
      const invalidSummary = customAttributes.invalid
        .slice(0, 5)
        .map((item) => `#${item.index + 1} length=${item.length}${item.issues.length ? ` issues=${item.issues.join(',')}` : ''}`)
        .join('; ');
      risks.push(`custom attributes invalid: ${invalidSummary}`);
    }
    return {
      pass: risks.length === 0,
      risks,
      titleLength: titleText.length,
      pcDescriptionChars,
      pcDescriptionImages,
      marketingImages,
      templates,
      requiredAttributes,
      unsafeRequiredAttributeDisplays,
      packageSale: {
        visible: packageSale.visible,
        checked: packageSale.checked,
        text: packageSale.text,
      },
      categoryEvidence,
      shipsFrom,
      price,
      variationRequiredFields,
      customAttributeCount: customAttributes.count,
      customAttributeInvalidCount: customAttributes.invalid.length,
    };
  }

  function makeReadonlyJsonSafe(value) {
    return JSON.parse(JSON.stringify(value, (key, item) => {
      if (key === 'node' || key === 'element' || key === 'container' || key === 'root' || key === 'checkbox' || key === 'section') return undefined;
      if (item && typeof Element !== 'undefined' && item instanceof Element) return undefined;
      if (item && typeof Node !== 'undefined' && item instanceof Node) return undefined;
      if (typeof item === 'function') return undefined;
      return item;
    }));
  }

  function getVisibleDangerousActionStatus() {
    const controls = Array.from(document.querySelectorAll('button,a,[role="button"],input[type="button"],input[type="submit"],span'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node))
      .map((node) => ({
        text: elementText(node) || String(node.value || ''),
        tag: String(node.tagName || '').toLowerCase(),
      }))
      .filter((item) => item.text && item.text.length <= 80);
    const publishControls = controls.filter((item) => /一键发布|采集并一键发布|发布/.test(item.text));
    const saveControls = controls.filter((item) => /保存并移入待发布|保存/.test(item.text) && !/发布/.test(item.text));
    return {
      publishControlVisible: publishControls.length > 0,
      publishControls: publishControls.slice(0, 10),
      saveControlVisible: saveControls.length > 0,
      saveControls: saveControls.slice(0, 10),
    };
  }

  function normalizeBusinessGateBlocker(blocker) {
    const raw = normalizeSpaces(blocker);
    const text = raw.toLowerCase();
    if (!text) return '';
    if (/category_evidence_missing|aliexpress category evidence/.test(text)) return 'category_evidence_missing';
    if (/aliexpress_category_confirmed_but_dxm_mapping_missing|aliexpress_dxm_category_map_missing/.test(text)) return 'aliexpress_dxm_category_map_missing';
    if (/product category is not selected|category is not selected|\u4ea7\u54c1\u5206\u7c7b.*(\u672a|\u7a7a)/i.test(raw)) return 'product_category_not_selected';
    if (/postage template is not 111|freight template is not 111|\u8fd0\u8d39.*111/i.test(raw)) return 'postage_template_not_111';
    if (/ships? from is not united states|\u53d1\u8d27\u5730.*(united states|\u7f8e\u56fd)/i.test(raw)) return 'ships_from_not_united_states';
    if (/sku_code_not_amazon_asin|sku.*amazon asin|sku.*asin|sku\s*\u7f16\u7801.*asin|\u5f53\u524d\s*asin/i.test(raw)) return 'sku_code_not_amazon_asin';
    if (/merchant_stock_not_15|merchant stock.*15|stock.*15|\u5546\u5bb6.*\u5e93\u5b58.*15|\u5e93\u5b58.*15/i.test(raw)) return 'merchant_stock_not_15';
    if (/amazon_asin_missing|current amazon asin.*missing|\u5f53\u524d.*asin.*(\u7f3a\u5931|\u4e3a\u7a7a)/i.test(raw)) return 'amazon_asin_missing';
    if (/variation_rows_missing|variation row.*missing|\u53d8\u79cd.*(\u884c|\u4fe1\u606f).*(\u7f3a\u5931|\u4e3a\u7a7a)/i.test(raw)) return 'variation_rows_missing';
    if (/amazon_displayed_price_missing|amazon_original_price_missing|price.*missing/.test(text)) return 'amazon_displayed_price_missing';
    if (/price_formula_missing_exchange_rate_or_multiplier/.test(text)) return 'price_formula_missing_exchange_rate_or_multiplier';
    if (/required attributes incomplete|product attribute|\u8bf7\u9009\u62e9\u4ea7\u54c1\u5c5e\u6027/.test(text)) return 'required_attributes_incomplete';
    return text.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'unknown_preflight_blocker';
  }

  function normalizeBusinessGateBlockers(blockers) {
    const seen = new Set();
    const output = [];
    (Array.isArray(blockers) ? blockers : []).forEach((blocker) => {
      const normalized = normalizeBusinessGateBlocker(blocker);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      output.push(normalized);
    });
    return output;
  }

  function businessGateNextAction(blockers) {
    if (blockers.includes('category_evidence_missing')) return 'run_aliexpress_category_verification_before_save';
    if (blockers.includes('aliexpress_dxm_category_map_missing')) return 'map_verified_aliexpress_category_to_dxm_before_save';
    if (blockers.includes('amazon_displayed_price_missing')) return 'recover_trusted_amazon_displayed_usd_price';
    if (blockers.includes('price_formula_missing_exchange_rate_or_multiplier')) return 'provide_task_exchange_rate_and_multiplier';
    if (blockers.includes('postage_template_not_111')) return 'select_real_postage_template_111_before_save';
    if (blockers.includes('ships_from_not_united_states')) return 'select_real_ships_from_united_states_before_save';
    if (blockers.includes('sku_code_not_amazon_asin')) return 'set_variation_sku_code_to_current_amazon_asin';
    if (blockers.includes('merchant_stock_not_15')) return 'set_merchant_stock_to_fixed_15';
    if (blockers.includes('amazon_asin_missing')) return 'recover_current_amazon_asin_before_edit_save';
    if (blockers.includes('variation_rows_missing')) return 'recover_or_create_variation_row_before_edit_save';
    if (blockers.includes('product_category_not_selected')) return 'select_verified_dxm_category_before_save';
    return 'manual_edit_preflight_review';
  }

  function buildReadonlyEditPreflightReadback() {
    const product = getProductFromEdit(state.editData) || {};
    const titleInput = findProductTitleInput();
    const titleText = titleInput ? getInputText(titleInput) : firstNonEmpty(product.subject, product.title, product.productTitle, '');
    const productId = extractProductIdFromCurrentPage();
    const asin = getCurrentEditAsinForEvidence(titleText, product);
    const dangerousActions = getVisibleDangerousActionStatus();
    let preflight = null;
    let error = '';
    if (isEditPage()) {
      try {
        preflight = getVisibleEditPreflightStatus();
      } catch (readError) {
        error = String(readError && readError.message ? readError.message : readError);
      }
    }
    const evidenceStore = readAliExpressEvidenceStore();
    const blockers = [];
    if (!isEditPage()) blockers.push('not_edit_page');
    if (error) blockers.push(`readonly_preflight_error: ${error}`);
    if (preflight && Array.isArray(preflight.risks)) blockers.push(...preflight.risks);
    if (dangerousActions.publishControlVisible) blockers.push('publish_control_visible');
    const normalizedBlockers = normalizeBusinessGateBlockers(blockers);
    const preflightPass = Boolean(preflight && preflight.pass);
    const safeToSaveToWaitPublish = Boolean(preflightPass && !dangerousActions.publishControlVisible && normalizedBlockers.length === 0);
    const result = {
      app: APP_NAME,
      version: VERSION,
      readonly: true,
      generatedAt: nowIso(),
      currentUrl: location.href,
      pageTitle: document.title,
      readyState: document.readyState,
      isEditPage: isEditPage(),
      productId,
      asin,
      sourceUrl: firstNonEmpty(product.sourceUrl, extractSourceUrlFromCurrentEditPage()),
      titleLength: titleText.length,
      evidenceStore: {
        ok: evidenceStore.ok,
        reason: evidenceStore.reason || '',
        cacheKey: ALIEXPRESS_EVIDENCE_STORE_KEY,
        schemaVersion: evidenceStore.store ? evidenceStore.store.schemaVersion : '',
        updatedAt: evidenceStore.store ? evidenceStore.store.updatedAt : '',
        recordCount: evidenceStore.store && evidenceStore.store.records ? Object.keys(evidenceStore.store.records).length : 0,
      },
      preflight: preflight ? makeReadonlyJsonSafe(preflight) : null,
      dangerousActions,
      preflightPass,
      publishRisk: dangerousActions.publishControlVisible,
      safeToSaveToWaitPublish,
      pass: preflightPass,
      blockers,
      businessGate: {
        allowed: safeToSaveToWaitPublish,
        blockers: normalizedBlockers,
        nextAction: normalizedBlockers.length
          ? businessGateNextAction(normalizedBlockers)
          : 'save_to_wait_publish_only_after_final_visible_confirmation',
      },
      error,
    };
    return makeReadonlyJsonSafe(result);
  }

  function writeReadonlyEditPreflightNode(result) {
    const payload = result || buildReadonlyEditPreflightReadback();
    let node = document.getElementById(READONLY_PREFLIGHT_NODE_ID);
    if (!node) {
      node = document.createElement('script');
      node.id = READONLY_PREFLIGHT_NODE_ID;
      node.type = 'application/json';
      node.style.display = 'none';
      (document.documentElement || document.body).appendChild(node);
    }
    node.textContent = JSON.stringify(payload);
    window.__DXM_AUTOMATION_V1_READONLY_PREFLIGHT_LAST__ = payload;
    return payload;
  }

  function getReadonlyEditPreflightReadback() {
    return writeReadonlyEditPreflightNode(buildReadonlyEditPreflightReadback());
  }

  function collectVisibleEditPageErrors() {
    const patterns = /(\u672a\u9009\u62e9|\u8bf7\u9009\u62e9|\u4e0d\u80fd\u8d85\u8fc7|\u4e0d\u80fd\u4e3a\u7a7a|\u5fc5\u586b|\u9519\u8bef|\u5931\u8d25)/;
    return Array.from(document.querySelectorAll('div,span,p,label,td'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node))
      .map((node) => elementText(node))
      .filter((text) => text && text.length < 220 && patterns.test(text))
      .filter((text, index, list) => list.indexOf(text) === index)
      .slice(0, 20);
  }

  function findEditPageSaveButton() {
    const buttons = Array.from(document.querySelectorAll('button,a,.ant-btn,input[type="button"]'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node))
      .map((node) => ({ node, text: elementText(node) || String(node.value || '') }));
    return (
      buttons.find((item) => item.text === '\u4fdd\u5b58\u5e76\u79fb\u5165\u5f85\u53d1\u5e03') ||
      buttons.find((item) => item.text === '\u4fdd\u5b58') ||
      buttons.find((item) => item.text.includes('\u4fdd\u5b58') && !item.text.includes('\u53d1\u5e03'))
    );
  }

  function findEditPageSaveToWaitPublishButton() {
    const buttons = Array.from(document.querySelectorAll('button,a,.ant-btn,input[type="button"],input[type="submit"]'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node))
      .map((node) => ({ node, text: String(elementText(node) || node.value || '').trim() }));
    return buttons.find((item) => item.text === '\u4fdd\u5b58\u5e76\u79fb\u5165\u5f85\u53d1\u5e03') || null;
  }

  function buildCurrentEditIdentitySnapshot() {
    const product = getProductFromEdit(state.editData) || {};
    const titleInput = findProductTitleInput();
    const titleText = titleInput ? getInputText(titleInput) : firstNonEmpty(product.subject, product.title, product.productTitle, '');
    return {
      editId: extractProductIdFromCurrentPage(),
      asin: getCurrentEditAsinForEvidence(titleText, product),
      titleLength: titleText.length,
      sourceUrl: firstNonEmpty(product.sourceUrl, extractSourceUrlFromCurrentEditPage()),
    };
  }

  async function applyFixedRequiredAttributeRecoveryFields(options = {}) {
    const fieldTimeoutMs = Number(options.fieldTimeoutMs || options.stageTimeoutMs || 10000);
    const fields = [
      { id: 'high_concerned_chemical', label: 'High-concerned chemical' },
      { id: 'origin', label: 'Origin' },
    ];
    const beforeStatus = getVisibleRequiredAttributeStatus();
    const beforeResults = fields.map((field) => {
      const readback = beforeStatus && Array.isArray(beforeStatus.fields)
        ? beforeStatus.fields.find((item) => item && item.id === field.id)
        : null;
      return { ...field, result: readback || { id: field.id, ok: false, reason: 'field readback not found' }, ok: Boolean(readback && readback.ok) };
    });
    if (beforeResults.every((entry) => entry.ok)) {
      return {
        ok: true,
        mode: 'already-ok-readback',
        results: beforeResults,
      };
    }
    const results = [];
    for (const field of fields) {
      const deadlineAt = makeDeadlineAt(fieldTimeoutMs);
      const result = await runSingleRequiredAttributeStep(field.id, { manual: true, fixedRecovery: true, deadlineAt });
      results.push({ ...field, result, ok: Boolean(result && result.ok) });
      if (!result || !result.ok) {
        return {
          ok: false,
          stoppedAt: field.id,
          timedOut: Boolean(result && result.timedOut),
          reason: `${field.label} fixed value not selected`,
          results,
        };
      }
    }
    return {
      ok: true,
      results,
    };
  }

  async function recoverCurrentEditToWaitPublish(options = {}) {
    const expectedAsin = extractAsin(options.asin || options.expectedAsin || '');
    const expectedEditId = String(options.editId || options.expectedEditId || '').trim();
    const shouldSave = options.save === true;
    const resultBase = {
      at: nowIso(),
      mode: 'recover-current-edit-to-wait-publish',
      manual: true,
      requested: {
        asin: expectedAsin,
        editId: expectedEditId,
        save: shouldSave,
      },
      currentUrl: location.href,
    };
    if (!isEditPage()) {
      return { ...resultBase, ok: false, stoppedAt: 'page', reason: 'not_edit_page' };
    }
    if (!expectedAsin || !expectedEditId) {
      return { ...resultBase, ok: false, stoppedAt: 'input', reason: 'recover requires asin and editId' };
    }
    if (!state.editData) {
      try {
        await loadEditJson();
      } catch (_) {
        // Visible page plus local stores are enough for identity and recovery checks.
      }
    }

    const beforeIdentity = buildCurrentEditIdentitySnapshot();
    const identityErrors = [];
    if (beforeIdentity.editId !== expectedEditId) identityErrors.push(`editId mismatch: expected ${expectedEditId}, current ${beforeIdentity.editId || 'empty'}`);
    if (beforeIdentity.asin !== expectedAsin) identityErrors.push(`asin mismatch: expected ${expectedAsin}, current ${beforeIdentity.asin || 'empty'}`);
    if (identityErrors.length) {
      const result = {
        ...resultBase,
        ok: false,
        stoppedAt: 'identity',
        identity: beforeIdentity,
        identityErrors,
      };
      state.visibleEditRuleResult = result;
      window.__DXM_AUTOMATION_V1_LAST_RESULT__ = result;
      log(`采集箱返工入口停止：${identityErrors.join('；')}`, result);
      updateUi();
      return result;
    }

    const stageTimeoutMs = getRecoverStageTimeoutMs(options, 15000);
    const fixedFieldTimeoutMs = Number(options.fixedFieldTimeoutMs || options.fieldTimeoutMs || 10000);
    const before = getReadonlyEditPreflightReadback();
    const recovery = await applyVisibleRemainingEditPageRules({
      manual: true,
      forceReset: true,
      resetReason: 'recover_to_wait_publish_entry',
      stageTimeoutMs,
      fixedFieldTimeoutMs,
    });
    if (recovery && (recovery.timedOut || (recovery.ok === false && recovery.stoppedAt))) {
      const afterRecoveryStop = getReadonlyEditPreflightReadback();
      const result = {
        ...resultBase,
        identity: beforeIdentity,
        before,
        recovery,
        fixedRequiredAttributes: { skipped: true, reason: 'recovery stopped before fixed required fields' },
        after: afterRecoveryStop,
        saveButton: { found: Boolean(findEditPageSaveToWaitPublishButton()), skipped: true },
        safeToSaveToWaitPublish: false,
        saved: false,
        ok: false,
        timedOut: Boolean(recovery.timedOut),
        stoppedAt: recovery.stoppedAt || 'recovery',
        reason: recovery.reason || 'recovery stopped before ready-to-save',
      };
      state.visibleEditRuleResult = result;
      window.__DXM_AUTOMATION_V1_LAST_RESULT__ = result;
      log(`采集箱返工入口停止：${result.stoppedAt}，${result.reason}`, result);
      updateUi();
      return result;
    }
    const fixedRequiredAttributes = await applyFixedRequiredAttributeRecoveryFields({ fieldTimeoutMs: fixedFieldTimeoutMs });
    const after = getReadonlyEditPreflightReadback();
    const saveButton = findEditPageSaveToWaitPublishButton();
    const result = {
      ...resultBase,
      identity: beforeIdentity,
      before,
      recovery,
      fixedRequiredAttributes,
      after,
      saveButton: saveButton ? { found: true, text: saveButton.text } : { found: false },
      safeToSaveToWaitPublish: Boolean(fixedRequiredAttributes.ok && after && after.pass && saveButton),
      saved: false,
      ok: Boolean(fixedRequiredAttributes.ok && after && after.pass && saveButton),
    };

    if (!result.ok || !shouldSave) {
      result.stoppedAt = result.ok ? 'ready_to_save' : (!fixedRequiredAttributes.ok ? 'fixedRequiredAttributes' : 'preflight');
      result.reason = result.ok
        ? 'preflight passed; save=false'
        : (!fixedRequiredAttributes.ok
          ? fixedRequiredAttributes.reason
          : (after && after.blockers && after.blockers.length ? after.blockers.join('; ') : 'preflight failed or save button missing'));
      state.visibleEditRuleResult = result;
      window.__DXM_AUTOMATION_V1_LAST_RESULT__ = result;
      log(`采集箱返工入口已执行：${result.ok ? '已达到可保存状态' : '未达到可保存状态'}，${result.reason}`, result);
      updateUi();
      return result;
    }

    clickElement(saveButton.node);
    await sleep(Number(options.saveWaitMs || 3500));
    const errors = collectVisibleEditPageErrors();
    result.saved = errors.length === 0;
    result.saveErrors = errors;
    result.ok = result.saved;
    result.stoppedAt = result.saved ? 'saved_to_wait_publish' : 'save_error';
    result.reason = result.saved ? 'saved_to_wait_publish' : errors.join('; ');
    state.visibleEditRuleResult = result;
    window.__DXM_AUTOMATION_V1_LAST_RESULT__ = result;
    if (!state.report) state.report = {};
    state.report.visibleEditRuleResult = result;
    log(`采集箱返工入口保存${result.saved ? '已点击并无页面错误' : '后仍有页面错误'}：${result.reason}`, result);
    updateUi();
    return result;
  }

  async function runEditPagePreflightAndFix(options = {}) {
    const result = await applyVisibleEditPageRules({ manual: false, preSave: true, ...options });
    if (!state.report) state.report = {};
    state.report.editPagePreflight = result;
    return result;
  }

  async function saveEditPageWithPreflight() {
    if (!isEditPage()) throw new Error('not edit page');
    const applyResult = await applyVisibleEditPageRules({ manual: true, preSave: true });
    let preflight = applyResult;
    if (!preflight.preflight.pass) {
      throw new Error(`edit preflight failed: ${preflight.preflight.risks.join('; ')}`);
    }

    const button = findEditPageSaveButton();
    if (!button) throw new Error('edit page save button not found');
    clickElement(button.node);
    await sleep(3500);

    let errors = collectVisibleEditPageErrors();
    let retry = null;
    if (errors.length && EDIT_PAGE_RULES.saveRetryLimit > 0) {
      retry = await runEditPagePreflightAndFix({ retryAfterSaveError: true });
      if (retry.preflight.pass) {
        const retryButton = findEditPageSaveButton();
        if (retryButton) {
          clickElement(retryButton.node);
          await sleep(3500);
          errors = collectVisibleEditPageErrors();
        }
      }
    }

    const result = {
      at: nowIso(),
      applyResult,
      preflight,
      retry,
      errors,
      clicked: button.text,
      ok: errors.length === 0,
    };
    if (!state.report) state.report = {};
    state.report.editPageSaveWithPreflight = result;
    log(`edit preflight save ${result.ok ? 'ok' : 'has errors'}: ${errors.join(' | ')}`, result);
    updateUi();
    return result;
  }

  function normalizeMarketingImageUrl(img) {
    const url = img && (img.currentSrc || img.src || img.getAttribute('data-src') || img.getAttribute('data-original') || '');
    if (/^data:image/i.test(url)) return '';
    if (!url || /loading|addImg|placeholder|logo|avatar|icon|sprite|static\/img/i.test(url)) return '';
    return url;
  }

  function getMarketingImageSection() {
    const scope = getEditFormScope();
    const roots = Array.from(scope.querySelectorAll('.ant-form-item,.form-group,.row,tr,td,div'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node))
      .map((node) => {
        const text = elementText(node);
        const rect = node.getBoundingClientRect();
        const hasMarketingLabel = /\u8425\u9500\u56fe\u7247/.test(text);
        const hasMarketingSlot = /1\s*:\s*1\s*\u767d\u5e95\u56fe|3\s*:\s*4\s*\u573a\u666f\u56fe/.test(text);
        const hasGenerateButton = Array.from(node.querySelectorAll('button,a,.ant-btn'))
          .some((item) => visibleElement(item) && elementText(item).includes('\u4e00\u952e\u751f\u6210'));
        return {
          node,
          text,
          textLength: text.length,
          area: rect.width * rect.height,
          hasMarketingLabel,
          hasMarketingSlot,
          hasGenerateButton,
          productImagePenalty: /\*\s*\u4ea7\u54c1\u56fe\u7247/.test(text) ? 5000 : 0,
        };
      })
      .filter((item) => item.hasMarketingLabel && (item.hasMarketingSlot || item.hasGenerateButton))
      .filter((item) => item.textLength < 2600)
      .sort((a, b) => (
        b.hasMarketingSlot - a.hasMarketingSlot
        || b.hasGenerateButton - a.hasGenerateButton
        || a.productImagePenalty - b.productImagePenalty
        || a.textLength - b.textLength
        || a.area - b.area
      ));
    return roots[0] || null;
  }

  function getMarketingImageSlotNodes(sectionNode) {
    if (!sectionNode) return [];
    const slotPattern = /1\s*:\s*1\s*\u767d\u5e95\u56fe|3\s*:\s*4\s*\u573a\u666f\u56fe/;
    const slots = Array.from(sectionNode.querySelectorAll('li,td,.ant-upload-list-item,.ant-upload,.image-item,.img-item,.pic-item,div'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node))
      .map((node) => ({ node, text: elementText(node), rect: node.getBoundingClientRect() }))
      .filter((item) => slotPattern.test(item.text) && item.text.length < 420)
      .sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left || a.text.length - b.text.length);
    return slots.map((item) => item.node).slice(0, EDIT_PAGE_RULES.marketingImageCount);
  }

  function readMarketingImageUrlsFromSlots(sectionNode) {
    const slots = getMarketingImageSlotNodes(sectionNode);
    const urls = [];
    for (const slot of slots) {
      const slotUrls = Array.from(slot.querySelectorAll('img'))
        .filter(visibleElement)
        .map(normalizeMarketingImageUrl)
        .filter(Boolean);
      if (slotUrls[0]) urls.push(slotUrls[0]);
    }
    const uniqueUrls = Array.from(new Set(urls));
    if (uniqueUrls.length >= EDIT_PAGE_RULES.marketingImageCount) return { slots, urls: uniqueUrls };
    const sectionUrls = Array.from(sectionNode.querySelectorAll('img'))
      .filter(visibleElement)
      .map(normalizeMarketingImageUrl)
      .filter(Boolean);
    return { slots, urls: Array.from(new Set(uniqueUrls.concat(sectionUrls))) };
  }

  function getMarketingImageStatus() {
    const section = getMarketingImageSection();
    if (!section) {
      return { ready: false, count: 0, urls: [], skipped: true, reason: 'marketing image section not visible' };
    }
    const { slots, urls } = readMarketingImageUrlsFromSlots(section.node);
    const uniqueUrls = Array.from(new Set(urls));
    return {
      ready: uniqueUrls.length >= EDIT_PAGE_RULES.marketingImageCount,
      count: uniqueUrls.length,
      urls: uniqueUrls.slice(0, EDIT_PAGE_RULES.marketingImageCount),
      slotCount: slots.length,
      sectionText: section.text.slice(0, 180),
      hasGenerateButton: section.hasGenerateButton,
      mode: 'marketing-slots-only',
    };
  }

  async function waitForMarketingImageStatus(timeoutMs = 12000, pollMs = 500) {
    const startedAt = Date.now();
    let status = getMarketingImageStatus();
    while (!status.ready && Date.now() - startedAt < timeoutMs) {
      await sleep(pollMs);
      status = getMarketingImageStatus();
    }
    return { ...status, waitedMs: Date.now() - startedAt };
  }

  async function triggerMarketingImageGeneration() {
    const before = getMarketingImageStatus();
    if (before.ready) return { changed: false, ok: true, action: 'already has marketing images', count: before.count, before };
    const section = getMarketingImageSection();
    if (!section) return { changed: false, ok: false, reason: 'marketing image section not visible', before };
    const buttons = Array.from(section.node.querySelectorAll('button,a,.ant-btn')).filter(visibleElement);
    const button = buttons.find((node) => elementText(node).includes('\u4e00\u952e\u751f\u6210'));
    if (!button) return { changed: false, ok: false, reason: 'one-click marketing image button not found in marketing image section', before };
    clickElement(button);
    const after = await waitForMarketingImageStatus();
    return {
      changed: after.ready || after.count > before.count,
      ok: after.ready,
      action: 'clicked one-click generate',
      count: after.count,
      before,
      after,
      waitedMs: after.waitedMs,
      reason: after.ready ? '' : `marketing images incomplete after one-click generate: ${after.count}/${EDIT_PAGE_RULES.marketingImageCount}`,
    };
  }

  async function applyVisibleCategoryAndPriceOnly(options = {}) {
    if (!isEditPage()) return { skipped: true, reason: 'not edit page' };
    const currentEditId = new URLSearchParams(location.search).get('id') || '';
    if (visibleEditRulesPipelineRunning) {
      return state.visibleEditRuleResult || { skipped: true, reason: 'visible edit pipeline already running' };
    }
    visibleEditRulesPipelineRunning = true;
    return withExclusiveEditExecution(async () => {
      try {
        if (!state.editData) {
          try {
            await loadEditJson();
          } catch (_) {
            // The visible page plus local stores are enough for this batch validation.
          }
        }
        const beforeScrollY = window.scrollY;
        const category = await selectVisibleProductCategory();
        const categoryPlan = buildCategoryModalSearchPlan(getCurrentEditTitleText());
        const categoryFinalize = category.ok
          ? (getVisibleCategoryModal()
            ? await finalizeCategorySelectionAfterVisibleWrite(categoryPlan)
            : { closed: true, mode: 'not-open-after-category', selectedText: category.selectedText || '' })
          : { closed: false, skipped: true, reason: category.reason || 'category not selected' };
        const priceFill = fillVisibleGoodsValueFromCurrentAsin();
        const preflight = getVisibleEditPreflightStatus();
        const result = {
          at: nowIso(),
          manual: Boolean(options.manual),
          currentEditId,
          mode: 'category-and-price-only',
          category,
          categoryFinalize,
          priceFill,
          preflight,
          scroll: {
            before: beforeScrollY,
            after: window.scrollY,
            blocked: editFieldLocks.scrollBlocked,
          },
        };
        state.visibleEditRuleResult = result;
        window.__DXM_AUTOMATION_V1_LAST_RESULT__ = result;
        if (!state.report) state.report = {};
        state.report.visibleEditRuleResult = result;
        log(`\u7f16\u8f91\u9875\u7b2c\u4e00\u6279\u5b57\u6bb5\u9a8c\u8bc1\uff1a\u7c7b\u76ee${category.ok ? '\u5df2\u9009' : '\u672a\u9009'}\uff0c\u7c7b\u76ee\u5f39\u7a97${categoryFinalize.closed ? '\u5df2\u6536\u5c3e' : '\u672a\u6536\u5c3e'}\uff0c\u4ef7\u683c${priceFill.ok ? '\u5df2\u5199\u5165' : '\u672a\u901a\u8fc7'}\uff0c\u9884\u68c0${preflight.pass ? '\u901a\u8fc7' : '\u672a\u901a\u8fc7'}`, result);
        updateUi();
        return result;
      } finally {
        visibleEditRulesPipelineRunning = false;
      }
    });
  }

  async function applyVisibleShippingAndPostageOnly(options = {}) {
    if (!isEditPage()) return { skipped: true, reason: 'not edit page' };
    const currentEditId = new URLSearchParams(location.search).get('id') || '';
    if (visibleEditRulesPipelineRunning) {
      return state.visibleEditRuleResult || { skipped: true, reason: 'visible edit pipeline already running' };
    }
    visibleEditRulesPipelineRunning = true;
    return withExclusiveEditExecution(async () => {
      try {
        const beforeScrollY = window.scrollY;
        const shipsFromBefore = getVisibleShipsFromStatus();
        const shipsFrom = selectVisibleShipsFromUnitedStates();
        const shipsFromAfter = getVisibleShipsFromStatus();
        const postage = await selectPostageTemplate111();
        const templates = verifyEditTemplateSelections();
        const preflight = getVisibleEditPreflightStatus();
        const result = {
          at: nowIso(),
          manual: Boolean(options.manual),
          currentEditId,
          mode: 'shipping-and-postage-only',
          shipsFromBefore,
          shipsFrom,
          shipsFromAfter,
          postage,
          templates,
          preflight,
          scroll: {
            before: beforeScrollY,
            after: window.scrollY,
            blocked: editFieldLocks.scrollBlocked,
          },
        };
        state.visibleEditRuleResult = result;
        window.__DXM_AUTOMATION_V1_LAST_RESULT__ = result;
        if (!state.report) state.report = {};
        state.report.visibleEditRuleResult = result;
        log(`\u7f16\u8f91\u9875\u7b2c\u4e8c\u6279\u5b57\u6bb5\u9a8c\u8bc1\uff1a\u53d1\u8d27\u5730${shipsFromAfter.ok ? '\u5df2\u9009\u7f8e\u56fd' : '\u672a\u9009'}\uff0c\u8fd0\u8d39111${templates.postage111 ? '\u5df2\u8bfb\u56de' : '\u672a\u8bfb\u56de'}\uff0c\u9884\u68c0${preflight.pass ? '\u901a\u8fc7' : '\u672a\u901a\u8fc7'}`, result);
        updateUi();
        return result;
      } finally {
        visibleEditRulesPipelineRunning = false;
      }
    });
  }

  async function applyVisibleRequiredAttributesOnly(options = {}) {
    if (!isEditPage()) return { skipped: true, reason: 'not edit page' };
    const currentEditId = new URLSearchParams(location.search).get('id') || '';
    if (visibleEditRulesPipelineRunning) {
      return state.visibleEditRuleResult || { skipped: true, reason: 'visible edit pipeline already running' };
    }
    visibleEditRulesPipelineRunning = true;
    return withExclusiveEditExecution(async () => {
      try {
        const beforeScrollY = window.scrollY;
        const fieldTimeoutMs = getRequiredAttributeFieldTimeoutMs(options, 8000);
        const requiredAttributes = await fillVisibleRequiredAttributeFields({ fieldTimeoutMs });
        const requiredStatus = getVisibleRequiredAttributeStatus();
        const unsafeRequiredAttributeDisplays = getUnsafeRequiredAttributeDisplays();
        const preflight = getVisibleEditPreflightStatus();
        const result = {
          at: nowIso(),
          manual: Boolean(options.manual),
          currentEditId,
          mode: 'required-attributes-only',
          fieldTimeoutMs,
          requiredAttributes,
          requiredStatus,
          unsafeRequiredAttributeDisplays,
          preflight,
          scroll: {
            before: beforeScrollY,
            after: window.scrollY,
            blocked: editFieldLocks.scrollBlocked,
          },
        };
        state.visibleEditRuleResult = result;
        window.__DXM_AUTOMATION_V1_LAST_RESULT__ = result;
        if (!state.report) state.report = {};
        state.report.visibleEditRuleResult = result;
        log(`\u7f16\u8f91\u9875\u7b2c\u4e09\u6279\u5b57\u6bb5\u9a8c\u8bc1\uff1a\u5fc5\u586b\u5c5e\u6027${requiredStatus.ok ? '\u5df2\u8bfb\u56de' : '\u672a\u901a\u8fc7'}\uff0c\u9884\u68c0${preflight.pass ? '\u901a\u8fc7' : '\u672a\u901a\u8fc7'}`, result);
        updateUi();
        return result;
      } finally {
        visibleEditRulesPipelineRunning = false;
      }
    });
  }

  async function applyVisibleRequiredAttributeFieldOnly(options = {}) {
    if (!isEditPage()) return { skipped: true, reason: 'not edit page' };
    const currentEditId = new URLSearchParams(location.search).get('id') || '';
    const fieldId = String(options.field || options.fieldId || '').trim();
    if (!fieldId) return { ok: false, reason: 'required attribute field is required', currentEditId };
    if (visibleEditRulesPipelineRunning) {
      return state.visibleEditRuleResult || { skipped: true, reason: 'visible edit pipeline already running' };
    }
    visibleEditRulesPipelineRunning = true;
    return withExclusiveEditExecution(async () => {
      try {
        const beforeScrollY = window.scrollY;
        const fieldTimeoutMs = getRequiredAttributeFieldTimeoutMs(options, 8000);
        const before = getVisibleRequiredAttributeStatus();
        const field = await runSingleRequiredAttributeStep(fieldId, { ...options, fieldTimeoutMs });
        await sleep(350);
        const requiredStatus = getVisibleRequiredAttributeStatus();
        const unsafeRequiredAttributeDisplays = getUnsafeRequiredAttributeDisplays();
        const preflight = getVisibleEditPreflightStatus();
        const result = {
          at: nowIso(),
          manual: Boolean(options.manual),
          currentEditId,
          mode: 'required-attribute-field-only',
          requestedField: fieldId,
          fieldTimeoutMs,
          before,
          field,
          requiredStatus,
          unsafeRequiredAttributeDisplays,
          preflight,
          scroll: {
            before: beforeScrollY,
            after: window.scrollY,
            blocked: editFieldLocks.scrollBlocked,
          },
        };
        state.visibleEditRuleResult = result;
        window.__DXM_AUTOMATION_V1_LAST_RESULT__ = result;
        if (!state.report) state.report = {};
        state.report.visibleEditRuleResult = result;
        log(`编辑页必填属性单字段验证：${fieldId} ${field.ok ? '已读回' : '未通过'}，预检${preflight.pass ? '通过' : '未通过'}`, result);
        updateUi();
        return result;
      } finally {
        visibleEditRulesPipelineRunning = false;
      }
    });
  }

  async function applyVisibleVariationAndFinalPreflightOnly(options = {}) {
    if (!isEditPage()) return { skipped: true, reason: 'not edit page' };
    const currentEditId = new URLSearchParams(location.search).get('id') || '';
    if (visibleEditRulesPipelineRunning) {
      return state.visibleEditRuleResult || { skipped: true, reason: 'visible edit pipeline already running' };
    }
    visibleEditRulesPipelineRunning = true;
    return withExclusiveEditExecution(async () => {
      try {
        if (!state.editData) {
          try {
            await loadEditJson();
          } catch (_) {
            // Visible page and local stores are enough for final field preflight.
          }
        }
        const beforeScrollY = window.scrollY;
        const title = applyVisibleTitleRule();
        const packageSale = disablePackageSaleIfChecked();
        let variation = null;
        try {
          variation = fillVisibleVariationFields();
        } catch (error) {
          variation = { changed: false, ok: false, allowed: false, blocked: true, blockReason: error.message };
        }
        const textSanitization = applyVisiblePlatformTextSanitization();
        const preflight = getVisibleEditPreflightStatus();
        const variationRequiredFields = getVisibleVariationRequiredFieldStatus();
        const result = {
          at: nowIso(),
          manual: Boolean(options.manual),
          currentEditId,
          mode: 'variation-and-final-preflight-only',
          title,
          packageSale,
          variation,
          variationRequiredFields,
          textSanitization,
          preflight,
          safeToSaveToWaitPublish: Boolean(preflight && preflight.pass),
          scroll: {
            before: beforeScrollY,
            after: window.scrollY,
            blocked: editFieldLocks.scrollBlocked,
          },
        };
        state.visibleEditRuleResult = result;
        window.__DXM_AUTOMATION_V1_LAST_RESULT__ = result;
        if (!state.report) state.report = {};
        state.report.visibleEditRuleResult = result;
        log(`\u7f16\u8f91\u9875\u7b2c\u56db\u6279\u5b57\u6bb5\u9a8c\u8bc1\uff1a\u6807\u9898${title.length <= EDIT_PAGE_RULES.titleMaxChars ? '\u5408\u89c4' : '\u8d85\u957f'}\uff0c\u53d8\u79cd${variation && variation.allowed ? '\u5df2\u5904\u7406' : '\u672a\u901a\u8fc7'}\uff0c\u6700\u7ec8\u9884\u68c0${preflight.pass ? '\u901a\u8fc7' : '\u672a\u901a\u8fc7'}`, result);
        updateUi();
        return result;
      } finally {
        visibleEditRulesPipelineRunning = false;
      }
    });
  }

  function resetVisibleEditPipelineLock(reason = 'manual_reset') {
    const result = {
      at: nowIso(),
      reason,
      wasRunning: visibleEditRulesPipelineRunning,
      editLockActive: editFieldLocks.active,
      scrollBlocked: editFieldLocks.scrollBlocked,
      lockViolationCount: editFieldLocks.lockViolations.length,
    };
    visibleEditRulesPipelineRunning = false;
    editFieldLocks.active = false;
    editFieldLocks.fields = {};
    editFieldLocks.scrollBlocked = 0;
    editFieldLocks.lockViolations = [];
    window.__DXM_AUTOMATION_V1_LAST_LOCK_RESET__ = result;
    return result;
  }

  function preflightHasRisk(preflight, pattern) {
    const risks = preflight && Array.isArray(preflight.risks) ? preflight.risks : [];
    return risks.some((risk) => pattern.test(String(risk || '')));
  }

  async function applyVisibleRemainingEditPageRules(options = {}) {
    if (!isEditPage()) return { skipped: true, reason: 'not edit page' };
    const currentEditId = new URLSearchParams(location.search).get('id') || '';
    if (EDIT_PAGE_MINIMAL_EXCLUSIVE_MODE) {
      if (currentEditId !== EDIT_PAGE_EXCLUSIVE_SAMPLE_ID) {
        return { skipped: true, reason: 'minimal exclusive mode is limited to the authorized sample', currentEditId };
      }
      return applyMinimalExclusiveEditPageRules();
    }
    let reset = null;
    if (visibleEditRulesPipelineRunning && options.forceReset !== false) {
      reset = resetVisibleEditPipelineLock(options.resetReason || 'resume_remaining_force_reset');
    }
    if (visibleEditRulesPipelineRunning) {
      return state.visibleEditRuleResult || { skipped: true, reason: 'visible edit pipeline already running' };
    }
    visibleEditRulesPipelineRunning = true;
    return withExclusiveEditExecution(async () => {
      try {
        if (!state.editData) {
          try {
            await loadEditJson();
          } catch (_) {
            // Visible page plus local stores are enough for segmented recovery.
          }
        }
        const beforeScrollY = window.scrollY;
        const stages = [];
        const before = getVisibleEditPreflightStatus();
        const stageTimeoutMs = getRecoverStageTimeoutMs(options, 0);
        const stageTimedOut = (startedAt) => Boolean(stageTimeoutMs && Date.now() - startedAt >= stageTimeoutMs);
        const stopStage = (stageId, startedAt, detail = {}) => {
          const timedOut = Boolean(detail.timedOut || stageTimedOut(startedAt));
          const preflight = getVisibleEditPreflightStatus();
          const result = {
            at: nowIso(),
            manual: Boolean(options.manual),
            mode: 'resume-remaining-edit-page-pipeline',
            currentEditId,
            reset,
            before,
            stages,
            preflight,
            ok: false,
            timedOut,
            stoppedAt: stageId,
            reason: detail.reason || (timedOut ? `stage timeout: ${stageId}` : `stage stopped: ${stageId}`),
            detail,
            safeToSaveToWaitPublish: false,
            scroll: {
              before: beforeScrollY,
              after: window.scrollY,
              blocked: editFieldLocks.scrollBlocked,
            },
          };
          state.visibleEditRuleResult = result;
          window.__DXM_AUTOMATION_V1_LAST_RESULT__ = result;
          if (!state.report) state.report = {};
          state.report.visibleEditRuleResult = result;
          log(`编辑页剩余字段恢复停止：${stageId}，${result.reason}`, result);
          updateUi();
          return result;
        };
        const publishStageProgress = (stageId, detail = {}) => {
          const progress = {
            at: nowIso(),
            manual: Boolean(options.manual),
            mode: 'remaining-edit-page-pipeline-progress',
            currentEditId,
            currentStage: stageId,
            inProgress: true,
            reset,
            before,
            stages: stages.map((stage) => ({ id: stage.id })),
            detail,
            scroll: {
              before: beforeScrollY,
              after: window.scrollY,
              blocked: editFieldLocks.scrollBlocked,
            },
          };
          state.visibleEditRuleResult = progress;
          window.__DXM_AUTOMATION_V1_LAST_RESULT__ = progress;
          if (!state.report) state.report = {};
          state.report.visibleEditRuleResult = progress;
          updateUi();
          return progress;
        };
        const runBoundedStage = async (stageId, task, timeoutMs = stageTimeoutMs) => {
          const startedAt = Date.now();
          publishStageProgress(stageId, { startedAt: new Date(startedAt).toISOString(), timeoutMs });
          if (!timeoutMs) return { timedOut: false, startedAt, value: await task() };
          let timer = null;
          try {
            return await Promise.race([
              Promise.resolve().then(task).then((value) => ({ timedOut: false, startedAt, value })),
              new Promise((resolve) => {
                timer = window.setTimeout(() => {
                  resolve({
                    timedOut: true,
                    startedAt,
                    value: buildStageTimeoutResult(stageId, startedAt + timeoutMs, {
                      reason: `stage hard timeout: ${stageId}`,
                    }),
                  });
                }, timeoutMs);
              }),
            ]);
          } finally {
            if (timer) window.clearTimeout(timer);
          }
        };
        const stageResolvedByPreflight = (stageId, preflight) => {
          if (!preflight) return false;
          if (stageId === 'pc-description-images') {
            return Boolean(preflight.pcDescriptionImages && preflight.pcDescriptionImages.ok && !preflightHasRisk(preflight, /PC description/i));
          }
          if (stageId === 'category-price') {
            return Boolean(preflight.templates && preflight.templates.categorySelected && preflight.price && preflight.price.ok && !preflightHasRisk(preflight, /product category|category path|category does not match|AliExpress category evidence|price invalid/i));
          }
          if (stageId === 'custom-attributes') {
            return Boolean(preflight.customAttributeInvalidCount === 0 && !preflightHasRisk(preflight, /custom attributes invalid/i));
          }
          if (stageId === 'shipping-postage') {
            return Boolean(preflight.templates && preflight.templates.postage111 && preflight.shipsFrom && preflight.shipsFrom.ok && !preflightHasRisk(preflight, /ships from|postage template/i));
          }
          if (stageId === 'variation') {
            return Boolean(preflight.variationRequiredFields && preflight.variationRequiredFields.ok && preflight.packageSale && !preflight.packageSale.checked && !preflightHasRisk(preflight, /variation parameter|variation required fields|package sale/i));
          }
          if (stageId === 'marketing-images') {
            return Boolean(preflight.marketingImages && preflight.marketingImages.ready && !preflightHasRisk(preflight, /marketing images/i));
          }
          if (/^required-attributes/.test(stageId)) {
            return Boolean(preflight.requiredAttributes && preflight.requiredAttributes.ok && !preflightHasRisk(preflight, /required attributes|unsafe required attribute/i));
          }
          return false;
        };
        const recoverTimedOutStageByReadback = async (stageId, detail = {}) => {
          await sleep(Number(options.timeoutRecoveryWaitMs || 900));
          const afterReadback = getVisibleEditPreflightStatus();
          return {
            recovered: stageResolvedByPreflight(stageId, afterReadback),
            stageId,
            afterReadback,
            detail,
          };
        };

        const title = applyVisibleTitleRule();
        stages.push({ id: 'title', result: title });
        const description = applyVisiblePcDescriptionRule(title.value || '');
        stages.push({ id: 'description', result: description });
        const descriptionImageStatus = await waitForVisiblePcDescriptionImageStatus();
        stages.push({ id: 'pc-description-images', result: descriptionImageStatus });
        if (!descriptionImageStatus.ok) {
          const recovery = await recoverTimedOutStageByReadback('pc-description-images', { description, descriptionImageStatus });
          stages[stages.length - 1].timeoutRecovery = recovery;
          if (recovery.recovered) {
            stages[stages.length - 1].recoveredByReadback = true;
          } else {
          return stopStage('pc-description-images', Date.now(), {
            reason: descriptionImageStatus.sourceImageCount < EDIT_PAGE_RULES.pcDescriptionMinImages
              ? `PC description source images missing: ${descriptionImageStatus.sourceImageCount}/${EDIT_PAGE_RULES.pcDescriptionMinImages}`
              : `PC description image-first/current product images incomplete: current ${descriptionImageStatus.currentProductImageCount}/${EDIT_PAGE_RULES.pcDescriptionMinImages}, leading ${descriptionImageStatus.leadingImageCount}/${EDIT_PAGE_RULES.pcDescriptionMinImages}`,
            description,
            descriptionImageStatus,
            recovery,
          });
          }
        }

        let current = getVisibleEditPreflightStatus();
        const needsCategory = !current.templates.categorySelected
          || preflightHasRisk(current, /product category|category path|category does not match|AliExpress category evidence/i);
        const needsPrice = !current.price || !current.price.ok;
        if (needsCategory || needsPrice) {
          const categoryPriceStage = await runBoundedStage('category-price', async () => {
            const category = needsCategory ? await selectVisibleProductCategory() : { skipped: true, reason: 'category already selected' };
            const categoryPlan = buildCategoryModalSearchPlan(getCurrentEditTitleText());
            const categoryFinalize = category.ok && getVisibleCategoryModal()
              ? await finalizeCategorySelectionAfterVisibleWrite(categoryPlan)
              : { closed: true, mode: category.ok ? 'not-open-after-category' : 'category-not-run-or-not-ok', selectedText: category.selectedText || current.templates.categorySelectedText || '' };
            const priceFill = fillVisibleGoodsValueFromCurrentAsin();
            return { category, categoryFinalize, priceFill };
          });
          const categoryPriceStartedAt = categoryPriceStage.startedAt;
          const { category, categoryFinalize, priceFill } = categoryPriceStage.value || {};
          stages.push({ id: 'category-price', category, categoryFinalize, priceFill });
          if (categoryPriceStage.timedOut || stageTimedOut(categoryPriceStartedAt)) {
            const recovery = await recoverTimedOutStageByReadback('category-price', { category, categoryFinalize, priceFill });
            stages[stages.length - 1].timeoutRecovery = recovery;
            if (recovery.recovered) {
              stages[stages.length - 1].recoveredByReadback = true;
              current = recovery.afterReadback;
            } else {
            return stopStage('category-price', categoryPriceStartedAt, { timedOut: true, category, categoryFinalize, priceFill, reason: 'stage hard timeout: category-price' });
            }
          }
          if (isCategoryCommitFailed(categoryFinalize)) {
            const preflight = getVisibleEditPreflightStatus();
            const result = {
              at: nowIso(),
              manual: Boolean(options.manual),
              currentEditId,
              mode: 'remaining-edit-page-pipeline',
              stoppedAt: 'categoryFinalize',
              reset,
              before,
              stages,
              preflight,
              scroll: {
                before: beforeScrollY,
                after: window.scrollY,
                blocked: editFieldLocks.scrollBlocked,
              },
            };
            state.visibleEditRuleResult = result;
            window.__DXM_AUTOMATION_V1_LAST_RESULT__ = result;
            if (!state.report) state.report = {};
            state.report.visibleEditRuleResult = result;
            log(`\u7f16\u8f91\u9875\u5206\u6bb5\u6d41\u6c34\u7ebf\u505c\u6b62\uff1a\u7c7b\u76ee\u56de\u586b\u672a\u786e\u8ba4`, result);
            updateUi();
            return result;
          }
        }

        current = getVisibleEditPreflightStatus();
        if (!current.requiredAttributes.ok || preflightHasRisk(current, /required attributes|unsafe required attribute/i)) {
          const fixedRequiredFieldTimeoutMs = Number(options.fixedFieldTimeoutMs || options.fieldTimeoutMs || Math.min(stageTimeoutMs || 8000, 8000) || 8000);
          const runFixedRequiredFieldStage = async (fieldId) => {
            const stageId = `required-attributes.${fieldId}`;
            const fieldTimeoutMs = fieldId === 'material'
              ? Math.max(fixedRequiredFieldTimeoutMs, 10000)
              : fixedRequiredFieldTimeoutMs;
            const fixedRequiredFieldHardTimeoutMs = fieldTimeoutMs ? fieldTimeoutMs + 5000 : 0;
            const fixedStage = await runBoundedStage(stageId, async () => {
              try {
                if (fieldId === 'material') {
                  await closeVisibleSelectDropdowns();
                  await ensureRequiredAttributeExpanded('material');
                }
                const field = await runSingleRequiredAttributeStep(fieldId, {
                  manual: Boolean(options.manual),
                  fixedRecovery: true,
                  deadlineAt: makeDeadlineAt(fieldTimeoutMs),
                });
                const requiredStatus = getVisibleRequiredAttributeStatus();
                const unsafeRequiredAttributeDisplays = getUnsafeRequiredAttributeDisplays();
                return { field, requiredStatus, unsafeRequiredAttributeDisplays };
              } finally {
                if (fieldId === 'material') {
                  await closeVisibleSelectDropdowns();
                }
              }
            }, fixedRequiredFieldHardTimeoutMs);
            const fixedStartedAt = fixedStage.startedAt;
            let { field, requiredStatus, unsafeRequiredAttributeDisplays } = fixedStage.value || {};
            if (!requiredStatus) requiredStatus = getVisibleRequiredAttributeStatus();
            if (!unsafeRequiredAttributeDisplays) unsafeRequiredAttributeDisplays = getUnsafeRequiredAttributeDisplays();
            const readbackField = requiredStatus && Array.isArray(requiredStatus.fields)
              ? requiredStatus.fields.find((item) => item && item.id === fieldId)
              : null;
            if ((!field || !field.ok) && readbackField && readbackField.ok) {
              field = {
                id: fieldId,
                ok: true,
                changed: true,
                locked: true,
                selectedText: readbackField.selectedText || '',
                mode: fixedStage.timedOut ? 'field-ok-after-hard-timeout-readback' : 'field-ok-after-readback',
                timedOut: Boolean(fixedStage.timedOut),
              };
            }
            const stageEntry = {
              id: stageId,
              field,
              requiredStatus,
              unsafeRequiredAttributeDisplays,
              timedOut: Boolean(fixedStage.timedOut || (field && field.timedOut)),
            };
            stages.push(stageEntry);
            if (!field || !field.ok) {
              stageEntry.nonFatal = true;
              stageEntry.reason = (field && field.reason) || `stage hard timeout: ${stageId}`;
              stageEntry.continuedAfterFailure = true;
            }
            return null;
          };
          const needsFixedRequiredField = (fieldId, status = current.requiredAttributes) => {
            const missing = status && Array.isArray(status.missing) ? status.missing : [];
            if (missing.includes(fieldId)) return true;
            const normalized = String(fieldId || '').replace(/_/g, ' ');
            return missing.some((item) => normalizeSelectMatchText(item).includes(normalizeSelectMatchText(normalized)));
          };
          if (needsFixedRequiredField('high_concerned_chemical')) {
            const highStop = await runFixedRequiredFieldStage('high_concerned_chemical');
            if (highStop) return highStop;
            current = getVisibleEditPreflightStatus();
          }
          if (needsFixedRequiredField('origin', current.requiredAttributes)) {
            const originStop = await runFixedRequiredFieldStage('origin');
            if (originStop) return originStop;
            current = getVisibleEditPreflightStatus();
          }
          if (needsFixedRequiredField('material', current.requiredAttributes)) {
            const materialStop = await runFixedRequiredFieldStage('material');
            if (materialStop) return materialStop;
            current = getVisibleEditPreflightStatus();
          }
        }

        current = getVisibleEditPreflightStatus();
        if (!current.requiredAttributes.ok || preflightHasRisk(current, /required attributes|unsafe required attribute/i)) {
          const requiredStage = await runBoundedStage('required-attributes', async () => {
            const requiredAttributes = await fillVisibleRequiredAttributeFields({
              deadlineAt: makeDeadlineAt(stageTimeoutMs),
              skipFieldIds: ['high_concerned_chemical', 'origin', 'material'],
            });
            const requiredStatus = getVisibleRequiredAttributeStatus();
            const unsafeRequiredAttributeDisplays = getUnsafeRequiredAttributeDisplays();
            return { requiredAttributes, requiredStatus, unsafeRequiredAttributeDisplays };
          });
          const requiredStartedAt = requiredStage.startedAt;
          const { requiredAttributes, requiredStatus, unsafeRequiredAttributeDisplays } = requiredStage.value || {};
          if (requiredStage.timedOut) {
            const requiredStatusNow = getVisibleRequiredAttributeStatus();
            const unsafeRequiredAttributeDisplaysNow = getUnsafeRequiredAttributeDisplays();
            if (requiredStatusNow && requiredStatusNow.ok && !(unsafeRequiredAttributeDisplaysNow && unsafeRequiredAttributeDisplaysNow.length)) {
              stages.push({
                id: 'required-attributes',
                requiredAttributes: requiredAttributes || { ok: true, timedOut: true, mode: 'ok-after-hard-timeout-readback' },
                requiredStatus: requiredStatus || requiredStatusNow,
                unsafeRequiredAttributeDisplays: unsafeRequiredAttributeDisplays || unsafeRequiredAttributeDisplaysNow,
                timedOut: true,
                recoveredByReadback: true,
              });
              current = getVisibleEditPreflightStatus();
            } else {
              const missingField = requiredStatusNow && Array.isArray(requiredStatusNow.missing)
                ? requiredStatusNow.missing.find((item) => !String(item || '').startsWith('red_star:')) || requiredStatusNow.missing[0]
                : '';
              const fieldStoppedAt = missingField ? `required-attributes.${missingField}` : 'required-attributes';
              stages.push({
                id: 'required-attributes',
                requiredAttributes,
                requiredStatus: requiredStatus || requiredStatusNow,
                unsafeRequiredAttributeDisplays: unsafeRequiredAttributeDisplays || unsafeRequiredAttributeDisplaysNow,
                timedOut: true,
                nonFatal: true,
                continuedAfterFailure: true,
                reason: `stage hard timeout: ${fieldStoppedAt}`,
              });
              current = getVisibleEditPreflightStatus();
            }
          } else {
            stages.push({ id: 'required-attributes', requiredAttributes, requiredStatus, unsafeRequiredAttributeDisplays });
          }
          if (!requiredStage.timedOut && (requiredAttributes.timedOut || stageTimedOut(requiredStartedAt))) {
            const requiredStatusNow = getVisibleRequiredAttributeStatus();
            const unsafeRequiredAttributeDisplaysNow = getUnsafeRequiredAttributeDisplays();
            if (requiredStatusNow && requiredStatusNow.ok && !(unsafeRequiredAttributeDisplaysNow && unsafeRequiredAttributeDisplaysNow.length)) {
              stages[stages.length - 1] = {
                id: 'required-attributes',
                requiredAttributes,
                requiredStatus: requiredStatus || requiredStatusNow,
                unsafeRequiredAttributeDisplays: unsafeRequiredAttributeDisplays || unsafeRequiredAttributeDisplaysNow,
                timedOut: true,
                recoveredByReadback: true,
              };
              current = getVisibleEditPreflightStatus();
            } else {
              stages[stages.length - 1] = {
                id: 'required-attributes',
                requiredAttributes,
                requiredStatus,
                unsafeRequiredAttributeDisplays,
                timedOut: true,
                nonFatal: true,
                continuedAfterFailure: true,
                reason: requiredAttributes.reason || 'stage timeout: required-attributes',
              };
              current = getVisibleEditPreflightStatus();
            }
          }
        }

        current = getVisibleEditPreflightStatus();
        if (current.customAttributeInvalidCount > 0 || preflightHasRisk(current, /custom attributes invalid/i)) {
          const customStage = await runBoundedStage('custom-attributes', async () => clearVisibleCustomAttributes());
          const customStartedAt = customStage.startedAt;
          const customAttributes = customStage.value;
          stages.push({ id: 'custom-attributes', customAttributes });
          if (customStage.timedOut || stageTimedOut(customStartedAt)) {
            const recovery = await recoverTimedOutStageByReadback('custom-attributes', { customAttributes });
            stages[stages.length - 1].timeoutRecovery = recovery;
            if (recovery.recovered) {
              stages[stages.length - 1].recoveredByReadback = true;
              current = recovery.afterReadback;
            } else {
              return stopStage('custom-attributes', customStartedAt, { timedOut: true, customAttributes, recovery, reason: 'stage hard timeout: custom-attributes' });
            }
          }
        }

        current = getVisibleEditPreflightStatus();
        if (!current.shipsFrom.ok || !current.templates.postage111 || preflightHasRisk(current, /ships from|postage template/i)) {
          const shippingStage = await runBoundedStage('shipping-postage', async () => {
            const shipsFromBefore = getVisibleShipsFromStatus();
            const shipsFrom = selectVisibleShipsFromUnitedStates();
            const shipsFromAfter = getVisibleShipsFromStatus();
            const postage = await selectPostageTemplate111FastPath({
              deadlineAt: makeDeadlineAt(Math.min(stageTimeoutMs || 3000, 3000)),
              timeoutStage: 'shipping-postage.fast-postage',
            });
            const templates = verifyEditTemplateSelections();
            return { shipsFromBefore, shipsFrom, shipsFromAfter, postage, templates };
          });
          const shippingStartedAt = shippingStage.startedAt;
          const { shipsFromBefore, shipsFrom, shipsFromAfter, postage, templates } = shippingStage.value || {};
          stages.push({ id: 'shipping-postage', shipsFromBefore, shipsFrom, shipsFromAfter, postage, templates });
          if (shippingStage.timedOut || (postage && postage.timedOut) || stageTimedOut(shippingStartedAt)) {
            const recovery = await recoverTimedOutStageByReadback('shipping-postage', { shipsFromBefore, shipsFrom, shipsFromAfter, postage, templates });
            stages[stages.length - 1].timeoutRecovery = recovery;
            if (recovery.recovered) {
              stages[stages.length - 1].recoveredByReadback = true;
              current = recovery.afterReadback;
            } else {
              stages[stages.length - 1].timedOut = true;
              stages[stages.length - 1].nonFatal = true;
              stages[stages.length - 1].continuedAfterFailure = true;
              stages[stages.length - 1].reason = (postage && postage.reason) || 'stage hard timeout: shipping-postage';
              current = recovery.afterReadback || getVisibleEditPreflightStatus();
            }
          }
        }

        current = getVisibleEditPreflightStatus();
        if (current.packageSale.checked || !current.variationRequiredFields.ok || preflightHasRisk(current, /variation parameter|variation required fields|package sale/i)) {
          const variationStage = await runBoundedStage('variation', async () => {
            const packageSale = disablePackageSaleIfChecked();
            let variation = null;
            try {
              variation = fillVisibleVariationFields();
            } catch (error) {
              variation = { changed: false, ok: false, allowed: false, blocked: true, blockReason: error.message };
            }
            return { packageSale, variation };
          });
          const { packageSale, variation } = variationStage.value || {};
          stages.push({ id: 'variation', packageSale, variation });
          if (variationStage.timedOut) {
            const recovery = await recoverTimedOutStageByReadback('variation', { packageSale, variation });
            stages[stages.length - 1].timeoutRecovery = recovery;
            if (recovery.recovered) {
              stages[stages.length - 1].recoveredByReadback = true;
              current = recovery.afterReadback;
            } else {
            return stopStage('variation', variationStage.startedAt, {
              timedOut: true,
              reason: 'stage hard timeout: variation',
              packageSale,
              variation,
              recovery,
            });
            }
          }
        }

        current = getVisibleEditPreflightStatus();
        if (!current.marketingImages.ready || preflightHasRisk(current, /marketing images/i)) {
          const marketingStage = await runBoundedStage('marketing-images', async () => {
            const beforeMarketing = getMarketingImageStatus();
            let marketing = null;
            try {
              marketing = await triggerMarketingImageGeneration();
            } catch (error) {
              marketing = { changed: false, ok: false, reason: error.message };
            }
            const afterMarketing = getMarketingImageStatus();
            return { beforeMarketing, marketing, afterMarketing };
          });
          const marketingStartedAt = marketingStage.startedAt;
          const marketingValue = marketingStage.value || {};
          const afterMarketing = marketingValue.afterMarketing || getMarketingImageStatus();
          stages.push({ id: 'marketing-images', ...marketingValue, afterMarketing });
          if (marketingStage.timedOut || stageTimedOut(marketingStartedAt) || !afterMarketing.ready) {
            const recovery = await recoverTimedOutStageByReadback('marketing-images', { ...marketingValue, afterMarketing });
            stages[stages.length - 1].timeoutRecovery = recovery;
            if (recovery.recovered) {
              stages[stages.length - 1].recoveredByReadback = true;
              current = recovery.afterReadback;
            } else {
            return stopStage('marketing-images', marketingStartedAt, {
              timedOut: Boolean(marketingStage.timedOut),
              reason: afterMarketing.ready ? 'stage hard timeout: marketing-images' : `marketing images incomplete: ${afterMarketing.count}/${EDIT_PAGE_RULES.marketingImageCount}`,
              ...marketingValue,
              afterMarketing,
              recovery,
            });
            }
          }
        }

        const textSanitization = applyVisiblePlatformTextSanitization();
        stages.push({ id: 'text-sanitization', result: textSanitization });

        const preflight = getVisibleEditPreflightStatus();
        const result = {
          at: nowIso(),
          manual: Boolean(options.manual),
          mode: 'resume-remaining-edit-page-pipeline',
          currentEditId,
          reset,
          before,
          stages,
          preflight,
          ok: Boolean(preflight && preflight.pass),
          safeToSaveToWaitPublish: Boolean(preflight && preflight.pass),
          scroll: {
            before: beforeScrollY,
            after: window.scrollY,
            blocked: editFieldLocks.scrollBlocked,
          },
        };
        state.visibleEditRuleResult = result;
        window.__DXM_AUTOMATION_V1_LAST_RESULT__ = result;
        if (!state.report) state.report = {};
        state.report.visibleEditRuleResult = result;
        log(`编辑页剩余字段恢复已执行：阶段${stages.map((stage) => stage.id).join(' -> ')}，最终预检${preflight.pass ? '通过' : '未通过'}`, result);
        updateUi();
        return result;
      } finally {
        visibleEditRulesPipelineRunning = false;
      }
    });
  }

  async function applyVisibleEditPageRules(options = {}) {
    if (!isEditPage()) return { skipped: true, reason: 'not edit page' };
    const currentEditId = new URLSearchParams(location.search).get('id') || '';
    if (EDIT_PAGE_MINIMAL_EXCLUSIVE_MODE) {
      if (currentEditId !== EDIT_PAGE_EXCLUSIVE_SAMPLE_ID) {
        return { skipped: true, reason: 'minimal exclusive mode is limited to the authorized sample', currentEditId };
      }
      return applyMinimalExclusiveEditPageRules();
    }
    if (visibleEditRulesPipelineRunning) {
      return state.visibleEditRuleResult || { skipped: true, reason: 'visible edit pipeline already running' };
    }
    visibleEditRulesPipelineRunning = true;
    return withExclusiveEditExecution(async () => {
      try {
      if (!state.editData) {
        try {
          await loadEditJson();
        } catch (_) {
          // Visible edit rules can still run without edit.json.
        }
      }
      const beforeScrollY = window.scrollY;
      const title = applyVisibleTitleRule();
      const description = applyVisiblePcDescriptionRule(title.value || '');
      const category = await selectVisibleProductCategory();
      if (!category.ok) {
        const preflight = getVisibleEditPreflightStatus();
        const result = {
          at: nowIso(),
          manual: Boolean(options.manual),
          preSave: Boolean(options.preSave),
          retryAfterSaveError: Boolean(options.retryAfterSaveError),
          currentEditId,
          mode: 'sequential-edit-page-pipeline',
          stoppedAt: 'category',
          title,
          description,
          category,
          preflight,
          scroll: {
            before: beforeScrollY,
            after: window.scrollY,
            blocked: editFieldLocks.scrollBlocked,
          },
        };
        state.visibleEditRuleResult = result;
        window.__DXM_AUTOMATION_V1_LAST_RESULT__ = result;
        if (!state.report) state.report = {};
        state.report.visibleEditRuleResult = result;
        log(`\u7f16\u8f91\u9875\u987a\u5e8f\u6d41\u6c34\u7ebf\u505c\u6b62\uff1a\u7c7b\u76ee\u672a\u786e\u8ba4\uff0c\u62e6\u622a\u6eda\u52a8${editFieldLocks.scrollBlocked}\u6b21`, result);
        updateUi();
        return result;
      }
      const categoryPlan = buildCategoryModalSearchPlan(getCurrentEditTitleText());
      const categoryFinalize = getVisibleCategoryModal()
        ? await finalizeCategorySelectionAfterVisibleWrite(categoryPlan)
        : { closed: true, mode: 'not-open-after-category', selectedText: category.selectedText || '' };
      if (isCategoryCommitFailed(categoryFinalize)) {
        const preflight = getVisibleEditPreflightStatus();
        const result = {
          at: nowIso(),
          manual: Boolean(options.manual),
          preSave: Boolean(options.preSave),
          retryAfterSaveError: Boolean(options.retryAfterSaveError),
          currentEditId,
          mode: 'sequential-edit-page-pipeline',
          stoppedAt: 'categoryFinalize',
          title,
          description,
          category,
          categoryFinalize,
          preflight,
          scroll: {
            before: beforeScrollY,
            after: window.scrollY,
            blocked: editFieldLocks.scrollBlocked,
          },
        };
        state.visibleEditRuleResult = result;
        window.__DXM_AUTOMATION_V1_LAST_RESULT__ = result;
        if (!state.report) state.report = {};
        state.report.visibleEditRuleResult = result;
        log(`\u7f16\u8f91\u9875\u987a\u5e8f\u6d41\u6c34\u7ebf\u505c\u6b62\uff1a\u7c7b\u76ee\u56de\u586b\u672a\u786e\u8ba4`, result);
        updateUi();
        return result;
      }
      const priceFill = fillVisibleGoodsValueFromCurrentAsin();
      const fieldTimeoutMs = getRequiredAttributeFieldTimeoutMs(options, 8000);
      const requiredAttributes = await fillVisibleRequiredAttributeFields({ fieldTimeoutMs });
      const customAttributes = await clearVisibleCustomAttributes();
      let marketing = null;
      try {
        marketing = await triggerMarketingImageGeneration();
      } catch (error) {
        marketing = { changed: false, ok: false, reason: error.message };
      }
      const shipsFrom = selectVisibleShipsFromUnitedStates();
      const packageSale = disablePackageSaleIfChecked();
      let variation = null;
      try {
        variation = fillVisibleVariationFields();
      } catch (error) {
        variation = { changed: false, reason: error.message };
      }
      const postage = await selectPostageTemplate111();
      const textSanitization = applyVisiblePlatformTextSanitization();
      const preflight = getVisibleEditPreflightStatus();
      const result = {
        at: nowIso(),
        manual: Boolean(options.manual),
        preSave: Boolean(options.preSave),
          retryAfterSaveError: Boolean(options.retryAfterSaveError),
          currentEditId,
          mode: 'sequential-edit-page-pipeline',
          fieldTimeoutMs,
          title,
        description,
        category,
        categoryFinalize,
        priceFill,
        requiredAttributes,
        customAttributes,
        marketing,
        shipsFrom,
        packageSale,
        variation,
        postage,
        textSanitization,
        preflight,
        scroll: {
          before: beforeScrollY,
          after: window.scrollY,
          blocked: editFieldLocks.scrollBlocked,
        },
      };
      state.visibleEditRuleResult = result;
      window.__DXM_AUTOMATION_V1_LAST_RESULT__ = result;
      if (!state.report) state.report = {};
      state.report.visibleEditRuleResult = result;
      log(`\u7f16\u8f91\u9875\u987a\u5e8f\u6d41\u6c34\u7ebf\u5df2\u6267\u884c\uff1a\u6807\u9898${title.changed ? '\u5df2\u6539' : '\u672a\u6539'}\uff0c\u63cf\u8ff0${description.changed ? '\u5df2\u6539' : '\u672a\u6539'}\uff0c\u7c7b\u76ee${category.ok ? '\u5df2\u9009' : '\u672a\u9009'}\uff0c\u5fc5\u586b\u5c5e\u6027${requiredAttributes.ok ? '\u5df2\u5904\u7406' : '\u672a\u5b8c\u6210'}\uff0c\u81ea\u5b9a\u4e49\u5c5e\u6027${customAttributes.ok ? '\u5df2\u5904\u7406' : '\u672a\u5408\u89c4'}\uff0c\u8425\u9500\u56fe${marketing && marketing.changed ? '\u5df2\u68c0\u67e5' : '\u672a\u751f\u6210'}\uff0c\u53d1\u8d27\u5730${shipsFrom.ok ? '\u5df2\u9009\u7f8e\u56fd' : '\u672a\u9009'}\uff0c\u8fd0\u8d39111${postage.ok ? '\u5df2\u9009' : '\u672a\u9009'}\uff0c\u9884\u68c0${preflight.pass ? '\u901a\u8fc7' : '\u672a\u901a\u8fc7'}\uff0c\u62e6\u622a\u6eda\u52a8${editFieldLocks.scrollBlocked}\u6b21`, result);
      updateUi();
      return result;
      } finally {
      visibleEditRulesPipelineRunning = false;
      }
    });
  }

  window.__DXM_AUTOMATION_V1_APPLY_EDIT_RULES__ = applyVisibleEditPageRules;
  window.__DXM_AUTOMATION_V1_READONLY_PREFLIGHT__ = getReadonlyEditPreflightReadback;
  window.__DXM_AUTOMATION_V1_FILL_VISIBLE_PRICE__ = fillVisibleGoodsValueFromCurrentAsin;
  window.__DXM_AUTOMATION_V1_FINALIZE_CATEGORY__ = finalizeCategorySelectionAfterVisibleWrite;
  window.__DXM_AUTOMATION_V1_CATEGORY_PRICE_ONLY__ = applyVisibleCategoryAndPriceOnly;
  window.__DXM_AUTOMATION_V1_SHIPPING_POSTAGE_ONLY__ = applyVisibleShippingAndPostageOnly;
  window.__DXM_AUTOMATION_V1_REQUIRED_ATTRS_ONLY__ = applyVisibleRequiredAttributesOnly;
  window.__DXM_AUTOMATION_V1_REQUIRED_ATTR_FIELD_ONLY__ = applyVisibleRequiredAttributeFieldOnly;
  window.__DXM_AUTOMATION_V1_VARIATION_PREFLIGHT_ONLY__ = applyVisibleVariationAndFinalPreflightOnly;
  window.__DXM_AUTOMATION_V1_RESET_PIPELINE_LOCK__ = resetVisibleEditPipelineLock;
  window.__DXM_AUTOMATION_V1_APPLY_REMAINING_EDIT_RULES__ = applyVisibleRemainingEditPageRules;
  window.__DXM_AUTOMATION_V1_RECOVER_TO_WAIT_PUBLISH__ = recoverCurrentEditToWaitPublish;

  function scheduleVisibleEditRulesAutoApply() {
    visibleEditRulesAutoAppliedUrl = isEditPage() ? `${location.pathname}${location.search}${location.hash}` : '';
  }

  function startVisibleEditRulesWatcher() {
    if (visibleEditRulesWatcherStarted) return;
    visibleEditRulesWatcherStarted = true;
    scheduleVisibleEditRulesAutoApply();
  }

  function getVisibleVariationTable() {
    const tables = Array.from(document.querySelectorAll('table'));
    return tables.find((table) => {
      const text = table.innerText || '';
      return text.includes('\u8d27\u503c') && text.includes('\u7269\u6d41\u8d39') && text.includes('SKU\u7f16\u7801') && text.includes('\u91cd\u91cf');
    });
  }

  function getHeaderMap(table) {
    const headerRow = table.tHead && table.tHead.rows && table.tHead.rows[0]
      ? table.tHead.rows[0]
      : Array.from(table.querySelectorAll('tr')).find((row) => row.querySelector('th'));
    const headers = headerRow ? Array.from(headerRow.children) : [];
    const map = {};
    headers.forEach((cell, index) => {
      const text = (cell.innerText || '').replace(/\s+/g, '');
      if (text.includes('\u8d27\u503c')) map.goodsValue = index;
      if (text.includes('\u7269\u6d41\u8d39')) map.logisticValue = index;
      if (text.includes('\u5546\u5bb6\u4ed3\u5e93\u5b58') || text.includes('\u5e93\u5b58')) map.stock = index;
      if (text.includes('SKU\u7f16\u7801')) map.skuCode = index;
      if (text.includes('\u91cd\u91cf')) map.weight = index;
      if (text.includes('\u5c3a\u5bf8')) map.size = index;
      if (text.includes('\u53d1\u8d27\u5730') || /ships?from/i.test(text)) map.shipFrom = index;
    });
    return map;
  }

  function getVariationRows(table) {
    const bodyRows = Array.from(table.querySelectorAll('tbody tr')).filter((row) => row.querySelector('input'));
    if (bodyRows.length) return bodyRows;
    return Array.from(table.querySelectorAll('tr')).slice(1).filter((row) => row.querySelector('input'));
  }

  function getCellInput(row, index, offset = 0) {
    const cells = Array.from(row.children);
    const cell = cells[index];
    if (!cell) return null;
    return Array.from(cell.querySelectorAll('input')).filter((input) => input.type !== 'hidden')[offset] || null;
  }

  function isVariationTextInput(input) {
    if (!input || input.type === 'hidden' || input.disabled) return false;
    const role = String(input.getAttribute('role') || '').toLowerCase();
    if (role === 'combobox') return false;
    const type = String(input.getAttribute('type') || 'text').toLowerCase();
    return !type || ['text', 'number', 'tel'].includes(type);
  }

  function getCellTextInputs(row, index) {
    const cells = Array.from(row.children);
    const cell = cells[index];
    if (!cell) return [];
    return Array.from(cell.querySelectorAll('input'))
      .filter(isVariationTextInput)
      .sort((a, b) => {
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        const aVisible = visibleElement(a) ? 0 : 1;
        const bVisible = visibleElement(b) ? 0 : 1;
        return aVisible - bVisible || ar.left - br.left || ar.top - br.top;
      });
  }

  function getVariationSizeInputs(row, sizeIndex) {
    if (sizeIndex == null) return [];
    const cells = Array.from(row.children);
    const inputs = [];
    for (let index = sizeIndex; index < cells.length && inputs.length < 3 && index <= sizeIndex + 3; index += 1) {
      for (const input of getCellTextInputs(row, index)) {
        if (!inputs.includes(input)) inputs.push(input);
        if (inputs.length >= 3) break;
      }
    }
    return inputs.slice(0, 3);
  }

  function readVariationSizeValues(row, sizeIndex) {
    const inputs = getVariationSizeInputs(row, sizeIndex);
    return [0, 1, 2].map((index) => (inputs[index] ? getInputText(inputs[index]) : ''));
  }

  function fillVariationSizeRow(row, sizeIndex, defaults) {
    const inputs = getVariationSizeInputs(row, sizeIndex);
    const values = [defaults.length, defaults.width, defaults.height];
    let changed = 0;
    values.forEach((value, index) => {
      if (inputs[index] && !isBlank(value)) changed += setInputValue(inputs[index], value) ? 1 : 0;
    });
    return { changed, values: readVariationSizeValues(row, sizeIndex), inputCount: inputs.length };
  }

  function fillVisibleShipFromCell(row, index) {
    if (index == null) return false;
    const cell = Array.from(row.children)[index];
    if (!cell) return false;
    const selectedText = getSelectedTextInContainer(cell);
    if (/united states|美国/i.test(selectedText)) return false;
    const input = Array.from(cell.querySelectorAll('input')).find((node) => node.type !== 'hidden' && visibleElement(node));
    if (input) return setInputValue(input, 'United States');
    const opener = Array.from(cell.querySelectorAll('.ant-select-selector,.ant-select,input[role="combobox"],input[type="search"],input[type="text"],button'))
      .filter(visibleElement)[0];
    if (!opener) return false;
    clickElement(opener);
    const option = findVisibleSelectOptionExact('United States') || findVisibleSelectOptionExact('\u7f8e\u56fd');
    return option ? forceSelectOption(option) : false;
  }

  function getVisibleFillDefaults() {
    const product = getProductFromEdit(state.editData) || {};
    const asin = extractAsin(`${product.sourceUrl || ''} ${product.sourceId || ''} ${product.platformProductId || ''} ${product.subject || ''}`);
    const amazonItem = getAmazonBatchItem(product);
    const priceState = getStrictPriceState();
    const supplyPrice = priceState.ok ? priceState.supplyPrice : '';
    const inferredAmazonWeightKg = inferAmazonWeightKg(product, amazonItem);
    const inferredAmazonDimensionsCm = inferAmazonDimensionsCm(product, amazonItem);
    return {
      skuCode: asin || state.productId,
      supplyPrice,
      priceState,
      logisticValue: '0',
      stock: getDefaultStock(),
      weight: firstNonEmpty(inferredAmazonWeightKg, getDefaultWeightKg()),
      length: firstNonEmpty(inferredAmazonDimensionsCm && inferredAmazonDimensionsCm.length, inchToCm(getDefaultLengthIn()), getDefaultLength()),
      width: firstNonEmpty(inferredAmazonDimensionsCm && inferredAmazonDimensionsCm.width, inchToCm(getDefaultWidthIn()), getDefaultWidth()),
      height: firstNonEmpty(inferredAmazonDimensionsCm && inferredAmazonDimensionsCm.height, inchToCm(getDefaultHeightIn()), getDefaultHeight()),
    };
  }

  function getVisiblePriceStatus() {
    const priceState = getStrictPriceState();
    const table = getVisibleVariationTable();
    if (!priceState.ok) {
      return { ok: false, reason: priceState.reason || 'missing trusted Amazon original price', priceState };
    }
    if (!table) {
      return { ok: false, reason: 'visible variation table not found', priceState };
    }
    const map = getHeaderMap(table);
    if (map.goodsValue == null) {
      return { ok: false, reason: 'goods value column not found', priceState };
    }
    const rows = getVariationRows(table);
    const values = rows.map((row) => {
      const input = getCellInput(row, map.goodsValue);
      return input ? getInputText(input) : '';
    });
    const mismatches = values.filter((value) => !priceEqualsExpected(value, priceState.supplyPrice));
    return {
      ok: rows.length > 0 && mismatches.length === 0,
      reason: rows.length
        ? mismatches.length
          ? `visible goods value mismatch: expected ${priceState.supplyPrice}, actual ${values.join(', ')}`
          : ''
        : 'variation rows not found',
      expectedSupplyPrice: priceState.supplyPrice,
      values,
      priceState,
    };
  }

  function getVisibleVariationRequiredFieldStatus() {
    const table = getVisibleVariationTable();
    if (!table) return { ok: false, reason: 'visible variation table not found', rows: 0, fields: [], missing: ['variation_table'] };
    const map = getHeaderMap(table);
    const rows = getVariationRows(table);
    const defaults = getVisibleFillDefaults();
    const fields = [];
    const missing = [];
    const readInput = (row, index, offset = 0) => {
      const input = getCellInput(row, index, offset);
      return input ? getInputText(input) : '';
    };
    const numericOrZero = (value) => {
      if (String(value || '').trim() === '0') return true;
      return positiveNumber(value) != null;
    };
    const addColumnCheck = (id, index, checker, expected = '') => {
      if (index == null) return;
      const values = rows.map((row) => readInput(row, index));
      const badRows = values
        .map((value, rowIndex) => ({ value, rowIndex }))
        .filter((item) => !checker(item.value, item.rowIndex));
      fields.push({
        id,
        ok: rows.length > 0 && badRows.length === 0,
        expected,
        values,
        badRows,
      });
      if (!rows.length || badRows.length) missing.push(id);
    };

    addColumnCheck('logisticValue', map.logisticValue, numericOrZero, defaults.logisticValue);
    addColumnCheck('stock', map.stock, (value) => String(value || '').trim() === String(defaults.stock || '').trim(), defaults.stock);
    addColumnCheck('skuCode', map.skuCode, (value) => {
      return normalizeCategoryText(value) === normalizeCategoryText(defaults.skuCode);
    }, defaults.skuCode);
    addColumnCheck('weight', map.weight, positiveNumber, defaults.weight);

    if (map.size != null) {
      const sizeRows = rows.map((row, rowIndex) => {
        const values = readVariationSizeValues(row, map.size);
        return {
          rowIndex,
          values,
          inputCount: getVariationSizeInputs(row, map.size).length,
          ok: values.every((value) => positiveNumber(value) != null),
        };
      });
      fields.push({
        id: 'size',
        ok: rows.length > 0 && sizeRows.every((row) => row.ok),
        expected: [defaults.length, defaults.width, defaults.height].join(' x '),
        values: sizeRows.map((row) => row.values.join(' x ')),
        badRows: sizeRows.filter((row) => !row.ok),
      });
      if (!rows.length || sizeRows.some((row) => !row.ok)) missing.push('size');
    }

    if (map.shipFrom != null) {
      const shipRows = rows.map((row, rowIndex) => {
        const cell = Array.from(row.children)[map.shipFrom];
        const selectedText = cell ? getSelectedTextInContainer(cell) || elementText(cell) : '';
        return {
          rowIndex,
          selectedText,
          ok: /united states|美国/i.test(selectedText),
        };
      });
      fields.push({
        id: 'shipFrom',
        ok: rows.length > 0 && shipRows.every((row) => row.ok),
        expected: 'United States',
        values: shipRows.map((row) => row.selectedText),
        badRows: shipRows.filter((row) => !row.ok),
      });
      if (!rows.length || shipRows.some((row) => !row.ok)) missing.push('shipFrom');
    }

    return {
      ok: rows.length > 0 && fields.every((field) => field.ok),
      reason: missing.length ? `variation required fields incomplete: ${missing.join(', ')}` : '',
      rows: rows.length,
      fields,
      missing,
    };
  }

  function fillVisibleGoodsValueFromCurrentAsin() {
    const priceState = getStrictPriceState();
    const table = getVisibleVariationTable();
    if (!priceState.ok) {
      return { changed: false, ok: false, reason: priceState.reason || 'missing trusted Amazon displayed price', priceState };
    }
    if (!table) {
      return { changed: false, ok: false, reason: 'visible variation table not found', priceState };
    }
    const map = getHeaderMap(table);
    if (map.goodsValue == null) {
      return { changed: false, ok: false, reason: 'goods value column not found', priceState };
    }
    const rows = getVariationRows(table);
    let changed = 0;
    rows.forEach((row) => {
      const input = getCellInput(row, map.goodsValue);
      if (input) changed += setInputValue(input, priceState.supplyPrice) ? 1 : 0;
    });
    const status = getVisiblePriceStatus();
    return {
      changed: changed > 0,
      changedFields: changed,
      ok: status.ok,
      reason: status.reason || '',
      expectedSupplyPrice: priceState.supplyPrice,
      values: status.values || [],
      rows: rows.length,
      priceState,
    };
  }

  const VISIBLE_COLOR_RULES = [
    { id: 'black', pattern: /\bblack\b|\u9ed1/i, label: /\bblack\b|\u9ed1/i },
    { id: 'white', pattern: /\bwhite\b|\u767d/i, label: /\bwhite\b|\u767d/i },
    { id: 'gray', pattern: /\bgr[ae]y\b|\u7070/i, label: /\bgr[ae]y\b|\u7070/i },
    { id: 'clear', pattern: /\bclear\b|\btransparent\b|\u900f\u660e/i, label: /\bclear\b|\btransparent\b|\u900f\u660e/i },
    { id: 'blue', pattern: /\bblue\b|\u84dd/i, label: /\bblue\b|\u84dd/i },
    { id: 'green', pattern: /\bgreen\b|\u7eff/i, label: /\bgreen\b|\u7eff/i },
    { id: 'red', pattern: /\bred\b|\u7ea2/i, label: /\bred\b|\u7ea2/i },
    { id: 'pink', pattern: /\bpink\b|\u7c89/i, label: /\bpink\b|\u7c89/i },
    { id: 'purple', pattern: /\bpurple\b|\u7d2b/i, label: /\bpurple\b|\u7d2b/i },
    { id: 'yellow', pattern: /\byellow\b|\u9ec4/i, label: /\byellow\b|\u9ec4/i },
    { id: 'orange', pattern: /\borange\b|\u6a59/i, label: /\borange\b|\u6a59/i },
    { id: 'brown', pattern: /\bbrown\b|\u68d5|\u8910/i, label: /\bbrown\b|\u68d5|\u8910/i },
    { id: 'beige', pattern: /\bbeige\b|\bcream\b|\u7c73|\u5976\u6cb9/i, label: /\bbeige\b|\bcream\b|\u7c73|\u5976\u6cb9/i },
    { id: 'silver', pattern: /\bsilver\b|\u94f6/i, label: /\bsilver\b|\u94f6/i },
    { id: 'gold', pattern: /\bgold\b|\u91d1/i, label: /\bgold\b|\u91d1/i },
  ];

  function getVisibleColorEvidenceText() {
    const product = getProductFromEdit(state.editData) || {};
    const amazonItem = getAmazonBatchItem(product) || {};
    const titleInput = findProductTitleInput();
    return [
      titleInput ? getInputText(titleInput) : '',
      product.subject,
      product.title,
      product.productTitle,
      product.description,
      product.detail,
      product.variationListStr,
      amazonItem.title,
      amazonItem.color,
      amazonItem.variant,
      amazonItem.variation,
    ].filter(Boolean).join(' ');
  }

  function inferVisibleColorPreference() {
    const text = normalizeCategoryText(getVisibleColorEvidenceText());
    if (!text) return { type: 'unknown', reason: 'no color evidence text' };
    if (/\bmulti[-\s]?color\b|\bmulticolor\b|\bmultiple colors?\b|\bassorted\b|\u591a\u8272|\u6df7\u8272/i.test(text)) {
      return { type: 'multi', reason: 'source explicitly indicates multiple colors' };
    }
    const matches = VISIBLE_COLOR_RULES.filter((rule) => rule.pattern.test(text));
    if (matches.length === 1) return { type: 'single', rule: matches[0], reason: `source indicates ${matches[0].id}` };
    if (matches.length > 1) return { type: 'multi', reason: `source contains multiple color terms: ${matches.map((item) => item.id).join(',')}` };
    return { type: 'unknown', reason: 'no supported single color term found' };
  }

  function labelColorText(label) {
    return elementText(label).replace(/\uff08/g, '(').replace(/\uff09/g, ')');
  }

  function findMultiColorLabel(labels) {
    return labels.find((node) => /\bmulti\b|\u591a\u8272/i.test(labelColorText(node)));
  }

  function getVisibleColorLabels() {
    const colorSection = Array.from(getEditFormScope().querySelectorAll('.ant-form-item,.form-group,.row,div,td,tr'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node))
      .map((node) => ({ node, text: elementText(node), rect: node.getBoundingClientRect() }))
      .filter((item) => /\u989c\u8272|color/i.test(item.text) && item.node.querySelector('input[type="checkbox"],input[type="radio"]') && item.text.length < 800)
      .sort((a, b) => a.text.length - b.text.length || a.rect.top - b.rect.top)[0];
    const scope = colorSection ? colorSection.node : getEditFormScope();
    const labels = Array.from(scope.querySelectorAll('label'))
      .filter((node) => !node.closest(`#${PANEL_ID}`) && visibleElement(node));
    return labels.filter((node) => node.querySelector('input[type="checkbox"],input[type="radio"]'));
  }

  function getVisibleColorParamStatus() {
    const colorLabels = getVisibleColorLabels();
    if (!colorLabels.length) return { ok: true, skipped: true, reason: 'color checkbox not visible', optionCount: 0 };
    const checked = colorLabels
      .map((label) => {
        const input = label.querySelector('input[type="checkbox"],input[type="radio"]');
        return input && input.checked ? { label, input, text: labelColorText(label) } : null;
      })
      .filter(Boolean);
    return {
      ok: checked.length > 0,
      selectedTexts: checked.map((item) => item.text),
      optionCount: colorLabels.length,
      missing: checked.length === 0,
    };
  }

  function selectVisibleColorClear() {
    const colorLabels = getVisibleColorLabels();
    if (!colorLabels.length) return { changed: false, ok: true, skipped: true, reason: 'color checkbox not visible' };
    const preference = inferVisibleColorPreference();
    let label = colorLabels.length === 1 ? colorLabels[0] : null;
    let mode = 'single-visible-option';
    if (!label && preference.type === 'single') {
      label = colorLabels.find((node) => preference.rule.label.test(labelColorText(node)));
      mode = 'source-single-color';
    }
    if (!label && (preference.type === 'multi' || preference.type === 'unknown')) {
      label = findMultiColorLabel(colorLabels);
      mode = preference.type === 'multi' ? 'source-multi-color' : 'fallback-multi-uncertain';
    }
    if (!label) {
      label = findMultiColorLabel(colorLabels);
      mode = 'fallback-multi-single-color-option-missing';
    }
    if (!label) return { changed: false, ok: false, reason: 'no matching Color option visible', colorPreference: preference, optionCount: colorLabels.length };
    const input = label.querySelector('input[type="checkbox"],input[type="radio"]');
    let changed = false;
    if (input && input.type === 'checkbox') {
      for (const colorLabel of colorLabels) {
        const colorInput = colorLabel.querySelector('input[type="checkbox"]');
        if (colorInput) changed = setCheckboxChecked(colorInput, colorInput === input) || changed;
      }
    } else {
      changed = setCheckboxChecked(input, true);
    }
    const status = getVisibleColorParamStatus();
    return {
      changed,
      ok: Boolean(input && input.checked && status.ok),
      selectedText: checkboxNearbyText(input),
      selectedTexts: status.selectedTexts || [],
      optionCount: colorLabels.length,
      mode,
      colorPreference: preference,
      defaultRule: preference.type === 'unknown' ? 'unknown color defaults to 多色(MULTI)' : '',
    };
  }

  function fillVisibleVariationFields() {
    const table = getVisibleVariationTable();
    if (!table) {
      throw new Error('\u5f53\u524d\u9875\u9762\u6ca1\u6709\u627e\u5230\u53ef\u586b\u5199\u7684\u53d8\u79cd\u4fe1\u606f\u8868\u683c\uff0c\u8bf7\u5148\u8fdb\u5165\u4ea7\u54c1\u7f16\u8f91\u9875\u5e76\u6eda\u52a8\u5230\u53d8\u79cd\u4fe1\u606f');
    }
    const map = getHeaderMap(table);
    const rows = getVariationRows(table);
    if (!rows.length) throw new Error('\u53d8\u79cd\u4fe1\u606f\u8868\u683c\u6ca1\u6709\u53ef\u586b\u5199\u884c');
    const defaults = getVisibleFillDefaults();
    const shipsFromStatus = getVisibleShipsFromStatus();
    const shipsFromParam = shipsFromStatus.ok
      ? { changed: false, ok: true, selectedText: shipsFromStatus.selectedText, mode: 'already-selected-global' }
      : selectVisibleShipsFromUnitedStates();
    const colorStatus = getVisibleColorParamStatus();
    const needsVariationAttribute = hasVisibleNativeValidationText(/\u8bf7\u9009\u62e9\u5fc5\u9009\u53d8\u79cd\u5c5e\u6027/) || colorStatus.missing;
    const colorParam = needsVariationAttribute || colorStatus.optionCount > 0
      ? selectVisibleColorClear()
      : { changed: false, ok: true, skipped: true, reason: 'variation color is not visible' };
    const packageSaleState = getPackageSaleState();
    const packageSale = packageSaleState.checked
      ? disablePackageSaleIfChecked()
      : { changed: false, ok: true, skipped: true, reason: 'package sale already unchecked' };

    let count = 0;
    rows.forEach((row, rowIndex) => {
      if (map.goodsValue != null && defaults.priceState && defaults.priceState.ok) count += setInputValue(getCellInput(row, map.goodsValue), defaults.supplyPrice) ? 1 : 0;
      if (map.logisticValue != null) count += setInputValue(getCellInput(row, map.logisticValue), defaults.logisticValue) ? 1 : 0;
      if (map.stock != null) count += setInputValue(getCellInput(row, map.stock), defaults.stock) ? 1 : 0;
      if (map.skuCode != null) {
        const skuValue = defaults.skuCode;
        count += setInputValue(getCellInput(row, map.skuCode), skuValue) ? 1 : 0;
      }
      if (map.weight != null) count += setInputValue(getCellInput(row, map.weight), defaults.weight) ? 1 : 0;
      if (map.shipFrom != null) count += fillVisibleShipFromCell(row, map.shipFrom) ? 1 : 0;
      if (map.size != null) {
        count += fillVariationSizeRow(row, map.size, defaults).changed;
      }
    });
    log(`\u5df2\u8865\u5f53\u524d\u7f16\u8f91\u9875\u53d8\u79cd\u4fe1\u606f\uff1a${rows.length} \u884c\uff0c\u5199\u5165 ${count} \u4e2a\u5b57\u6bb5`);
    const blockedReasons = [];
    if (!defaults.priceState || !defaults.priceState.ok) blockedReasons.push(`price: ${defaults.priceState && defaults.priceState.reason ? defaults.priceState.reason : 'missing trusted Amazon original price'}`);
    if (shipsFromParam.ok === false) blockedReasons.push(`shipsFrom: ${shipsFromParam.reason || shipsFromParam.selectedText || 'not United States'}`);
    if (colorParam.ok === false) blockedReasons.push(`color: ${colorParam.reason || colorParam.selectedText || 'not clear'}`);
    return {
      rows: rows.length,
      fields: count,
      status: blockedReasons.length ? 'blocked' : 'allowed',
      allowed: blockedReasons.length === 0,
      blocked: blockedReasons.length > 0,
      blockReason: blockedReasons.join('; '),
      price: defaults.priceState,
      shipsFromParam,
      colorParam,
      packageSale,
    };
  }

  function downloadBlob(blob, fileName) {
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadJson(value, fileName) {
    downloadBlob(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' }), fileName);
  }

  function compactDateForFile(date) {
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  }

  function getRunId() {
    if (state.report && state.report.runId) return state.report.runId;
    const runId = `${compactDateForFile(new Date())}-${state.productId || (state.payload && state.payload.id) || 'unknown'}`;
    if (state.report) state.report.runId = runId;
    return runId;
  }

  function getPrimaryAsinFromPayload(payload) {
    if (!payload) return '';
    const rows = parseMaybeJson(payload.variationListStr, []);
    const firstSku = Array.isArray(rows) && rows[0] ? rows[0] : {};
    return firstNonEmpty(firstSku.skuCode, extractAsin(`${payload.sourceUrl || ''} ${payload.subject || ''}`));
  }

  function isSaveResponseSuccess(response) {
    return response && (response.code === 0 || String(response.code) === '0');
  }

  function buildFinalReport() {
    const payload = state.payload || {};
    const dryRunPass = Boolean(state.report && state.report.pass);
    const op1Response = state.report && state.report.completionSaveResult && state.report.completionSaveResult.response;
    const op2Response = state.report && state.report.submitResult && state.report.submitResult.response;
    const persisted = Boolean(state.report && state.report.persistenceCheck && state.report.persistenceCheck.persisted);
    const op2Success = isSaveResponseSuccess(op2Response);
    const failureReason = !dryRunPass
      ? 'dry-run \u672a\u901a\u8fc7'
      : op1Response && !isSaveResponseSuccess(op1Response)
      ? 'op=1 save.json \u8fd4\u56de\u5931\u8d25'
      : state.report && state.report.persistenceCheck && !persisted
      ? 'op=1 \u540e edit.json \u843d\u5e93\u6821\u9a8c\u672a\u901a\u8fc7'
      : op2Response && !op2Success
      ? 'op=2 save.json \u8fd4\u56de\u5931\u8d25'
      : '';
    return {
      runId: getRunId(),
      category:
        state.report &&
        state.report.categoryState &&
        state.report.categoryState.resolver &&
        state.report.categoryState.resolver.status === 'resolved' &&
        state.report.categoryState.resolver.ruleId
          ? state.report.categoryState.resolver.ruleId
          : state.report && state.report.categoryState && state.report.categoryState.resolver
          ? `category-resolver-${state.report.categoryState.resolver.status || 'unknown'}`
          : 'category-resolver',
      productId: String(firstNonEmpty(payload.id, state.productId)),
      asin: getPrimaryAsinFromPayload(payload),
      stage: 'single-product',
      pluginVersion: VERSION,
      taskConfig: {
        stock: getDefaultStock(),
        exchangeRate: getTaskExchangeRate(),
        priceMultiplier: getTaskPriceMultiplier(),
        defaultWeightKg: getDefaultWeightKg(),
      },
      valueSources: state.report && state.report.diagnostics && state.report.diagnostics.derived
        ? state.report.diagnostics.derived.valueSources
        : null,
      dryRun: {
        pass: dryRunPass,
        riskCount: state.report && state.report.risks ? state.report.risks.length : null,
        warningCount: state.report && state.report.warnings ? state.report.warnings.length : null,
      },
      op1: {
        called: Boolean(op1Response),
        success: isSaveResponseSuccess(op1Response),
        persisted,
      },
      op2: {
        called: Boolean(op2Response),
        success: op2Success,
        responseCode: op2Response ? op2Response.code : null,
      },
      result: op2Success ? 'success' : failureReason ? 'failed' : 'pending',
      failureReason,
    };
  }

  function buildRunBundleFiles() {
    const payloadText = state.payload ? JSON.stringify(state.payload) : '';
    const prettyPayloadText = state.payload ? JSON.stringify(state.payload, null, 2) : '';
    const dryRunReport = state.report ? { ...state.report } : {};
    delete dryRunReport.completionSaveResult;
    delete dryRunReport.submitResult;
    delete dryRunReport.persistenceCheck;
    const files = [
      { fileName: 'final-report.json', text: JSON.stringify(buildFinalReport(), null, 2) },
      { fileName: 'dry-run-report.json', text: JSON.stringify(dryRunReport, null, 2) },
      { fileName: 'choiceSave.txt', text: payloadText },
      { fileName: 'choiceSave.pretty.json', text: prettyPayloadText },
    ];
    if (state.inputEditData) files.push({ fileName: 'input-edit.json', text: JSON.stringify(state.inputEditData, null, 2) });
    if (state.report && state.report.completionSaveResult) {
      files.push({ fileName: 'op1-save-response.json', text: JSON.stringify(state.report.completionSaveResult.response, null, 2) });
    }
    if (state.afterOp1EditData) files.push({ fileName: 'after-op1-edit.json', text: JSON.stringify(state.afterOp1EditData, null, 2) });
    if (state.savePayloadLearning) files.push({ fileName: 'save-payload-learning.json', text: JSON.stringify(state.savePayloadLearning, null, 2) });
    if (state.report && state.report.persistenceCheck) {
      files.push({ fileName: 'op1-persistence-report.json', text: JSON.stringify(state.report.persistenceCheck, null, 2) });
    }
    if (state.report && state.report.submitResult) {
      files.push({ fileName: 'op2-save-response.json', text: JSON.stringify(state.report.submitResult.response, null, 2) });
    }
    return files;
  }

  function downloadRunBundle() {
    if (!state.report) throw new Error('\u8fd8\u6ca1\u6709\u6267\u884c\u62a5\u544a\uff0c\u8bf7\u5148\u6784\u9020 dry-run');
    const runId = getRunId();
    const files = buildRunBundleFiles().map((file) => ({
      ...file,
      fileName: `${runId}/${file.fileName}`,
    }));
    downloadBlob(makeStoredZipFiles(files), `${runId}.zip`);
    log(`\u5df2\u5bfc\u51fa run \u62a5\u544a\u5305\uff1a${runId}.zip`);
  }

  async function submitOne() {
    throw new Error('本阶段禁止 op=2；请先完成 op=1 落库验证并等待人工授权');
  }

  function isVisibleElement(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  function getElementText(el) {
    return String((el && (el.innerText || el.textContent || el.value)) || '').replace(/\s+/g, ' ').trim();
  }

  function findPublishTestRow() {
    const tokens = [CURRENT_PUBLISH_TEST.asin, CURRENT_PUBLISH_TEST.productId, CURRENT_PUBLISH_TEST.titleToken].filter(Boolean);
    const directRows = Array.from(document.querySelectorAll('tr, .el-table__row, [class*="table-row"], [class*="list-row"]'));
    const row = directRows.find((el) => {
      const text = getElementText(el);
      return tokens.some((token) => text.includes(token)) && text.includes('发布');
    });
    if (row) return row;

    const all = Array.from(document.querySelectorAll('a, span, div, td'));
    const marker = all.find((el) => {
      const text = getElementText(el);
      return tokens.some((token) => text.includes(token));
    });
    if (!marker) return null;
    return marker.closest('tr, .el-table__row, [class*="table-row"], [class*="list-row"]') || marker.parentElement;
  }

  function findPublishActionInRow(row) {
    if (!row) return null;
    const candidates = Array.from(row.querySelectorAll('a, button, [role="button"], span, div')).filter(isVisibleElement);
    return candidates.find((el) => getElementText(el) === '发布')
      || candidates.find((el) => /^发布$/.test(getElementText(el)))
      || candidates.find((el) => getElementText(el).includes('发布') && !getElementText(el).includes('发布失败'));
  }

  function findActiveDialog() {
    const candidates = Array.from(document.querySelectorAll(
      '.layui-layer, .layui-layer-dialog, .modal, .el-message-box, .ant-modal, .ui-dialog, [role="dialog"], .bootbox'
    )).filter(isVisibleElement);
    return candidates[candidates.length - 1] || null;
  }

  function clickDialogConfirmIfPublishRelated() {
    const dialog = findActiveDialog();
    if (!dialog) return { clicked: false, reason: 'no-dialog' };
    const text = getElementText(dialog);
    if (!/发布|提交|确认|产品/.test(text)) return { clicked: false, reason: 'dialog-not-publish-related', text: text.slice(0, 300) };
    const buttons = Array.from(dialog.querySelectorAll('a, button, [role="button"], span')).filter(isVisibleElement);
    const confirm = buttons.find((el) => /^(确定|确认|发布|提交)$/.test(getElementText(el)))
      || buttons.find((el) => /确定|确认/.test(getElementText(el)));
    if (!confirm) return { clicked: false, reason: 'confirm-not-found', text: text.slice(0, 300) };
    confirm.click();
    return { clicked: true, text: text.slice(0, 300), button: getElementText(confirm) };
  }

  function collectPublishSignals() {
    const apiRecords = state.apiRecords
      .filter((record) => /publish|online|offline|smtlocalProduct|save\.json/i.test(record.url || ''))
      .slice(-20);
    const bodyText = document.body ? getElementText(document.body) : '';
    const row = findPublishTestRow();
    const successText = (bodyText.match(/[^。！？\n]{0,30}(成功|提交成功|发布中|已提交)[^。！？\n]{0,50}/) || [''])[0];
    const errorText = (bodyText.match(/[^。！？\n]{0,30}(失败|错误|异常|不能为空|请选择|超时)[^。！？\n]{0,80}/) || [''])[0];
    return {
      checkedAt: nowIso(),
      rowStillInWaitPublish: Boolean(row),
      successText,
      errorText,
      apiRecords,
      currentUrl: location.href,
    };
  }

  async function publishCurrentTestProduct() {
    if (!/\/web\/smtlocalProduct\/offline/i.test(location.pathname)) {
      throw new Error('请在店小秘待发布产品列表页执行发布验证');
    }
    const allow = $(`#${PANEL_ID} [data-field="allowSubmit"]`);
    const code = $(`#${PANEL_ID} [data-field="submitCode"]`);
    if (!allow || !allow.checked || !code || code.value.trim() !== 'SUBMIT-ONE') {
      throw new Error('发布前必须勾选只提交 1 个测试产品，并输入 SUBMIT-ONE');
    }

    const row = findPublishTestRow();
    if (!row) throw new Error(`未找到当前测试商品行：${CURRENT_PUBLISH_TEST.asin}`);
    const action = findPublishActionInRow(row);
    if (!action) throw new Error('已找到测试商品行，但未找到该行的“发布”按钮');

    state.submitting = true;
    state.publishResult = {
      status: '已点击发布按钮',
      target: CURRENT_PUBLISH_TEST,
      clickedAt: nowIso(),
      rowText: getElementText(row).slice(0, 1000),
      actionText: getElementText(action),
    };
    updateUi();
    log(`准备发布当前测试商品：${CURRENT_PUBLISH_TEST.asin}`);
    action.click();

    window.setTimeout(() => {
      const dialogResult = clickDialogConfirmIfPublishRelated();
      state.publishResult.dialogResult = dialogResult;
      if (dialogResult.clicked) log(`已确认发布弹窗：${dialogResult.button}`);
      updateUi();
    }, 800);

    window.setTimeout(() => {
      const signals = collectPublishSignals();
      state.publishResult = {
        ...state.publishResult,
        ...signals,
        status: signals.errorText
          ? '发布后出现错误提示'
          : signals.rowStillInWaitPublish
            ? '已提交发布，待人工核对状态'
            : '测试商品已离开待发布列表',
      };
      state.submitting = false;
      updateUi();
      log(`发布验证状态：${state.publishResult.status}`, state.publishResult);
    }, 6000);
  }

  function createPanel() {
    if (document.getElementById(PANEL_ID)) return;
    if (!document.body || !document.documentElement) return;
    document.documentElement.setAttribute('data-dxm-automation-version', VERSION);
    const style = document.createElement('style');
    style.textContent = `
      #${PANEL_ID} {
        position: fixed;
        right: 10px;
        bottom: 74px;
        z-index: 2147483647;
        width: 260px;
        min-width: 170px;
        max-width: 520px;
        min-height: 36px;
        max-height: 56vh;
        resize: both;
        overflow: auto;
        background: #fff;
        border: 1px solid #475569;
        border-radius: 7px;
        box-shadow: 0 10px 26px rgba(15, 23, 42, .18);
        color: #111827;
        font: 11px/1.35 Arial, "Microsoft YaHei", sans-serif;
      }
      #${PANEL_ID} * { box-sizing: border-box; }
      #${PANEL_ID} .dxm-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 8px;
        border-bottom: 1px solid #e5e7eb;
        cursor: move;
        user-select: none;
      }
      #${PANEL_ID} .dxm-body {
        padding: 7px;
        overflow: auto;
      }
      #${PANEL_ID} .dxm-row {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 6px;
      }
      #${PANEL_ID} input[type="text"] {
        width: 100%;
        min-height: 24px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 3px 5px;
      }
      #${PANEL_ID} button {
        min-height: 24px;
        border: 1px solid #cbd5e1;
        border-radius: 5px;
        background: #f8fafc;
        color: #111827;
        cursor: pointer;
        font: inherit;
      }
      #${PANEL_ID} button:hover { background: #eef2ff; }
      #${PANEL_ID} button:disabled {
        cursor: not-allowed;
        opacity: .45;
      }
      #${PANEL_ID} .dxm-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 5px;
        margin-top: 7px;
      }
      #${PANEL_ID} .dxm-mini-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 6px;
        margin-top: 6px;
      }
      #${PANEL_ID} .dxm-danger {
        color: #991b1b;
        border-color: #fecaca;
        background: #fff1f2;
      }
      #${PANEL_ID} .dxm-log {
        height: 48px;
        min-height: 40px;
        max-height: 160px;
        resize: vertical;
        overflow: auto;
        margin-top: 8px;
        padding: 6px;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        background: #f8fafc;
      }
      #${PANEL_ID} label {
        display: flex;
        gap: 6px;
        align-items: center;
        margin-top: 8px;
      }
      #${PANEL_ID}.dxm-collapsed {
        width: 172px;
        resize: none;
        overflow: hidden;
      }
      #${PANEL_ID}.dxm-collapsed .dxm-body {
        display: none;
      }
      #${PANEL_ID} .dxm-header-actions {
        display: flex;
        gap: 6px;
        align-items: center;
      }
      #${PANEL_ID} .dxm-icon-btn {
        width: 24px;
        min-height: 22px;
        padding: 0;
      }
    `;
    document.documentElement.appendChild(style);

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    const collapsedValue = localStorage.getItem(COLLAPSED_KEY);
    const defaultCollapsed = /\/web\/productCrawl\/dataAcquisition/i.test(location.pathname);
    if (collapsedValue === '1' || (collapsedValue == null && defaultCollapsed)) {
      panel.classList.add('dxm-collapsed');
    }
    panel.innerHTML = `
      <div class="dxm-header">
        <strong>${APP_NAME} V${VERSION}</strong>
        <div class="dxm-header-actions">
          <span>\u7edf\u4e00\u5de5\u4f5c\u6d41</span>
          <button type="button" class="dxm-icon-btn" data-action="collapse" title="\u6536\u8d77/\u5c55\u5f00">-</button>
        </div>
      </div>
      <div class="dxm-body">
        <div class="dxm-row"><span>\u4ea7\u54c1ID</span><strong data-field="productId">\u672a\u8bfb\u53d6</strong></div>
        <div class="dxm-row"><span>dry-run</span><strong data-field="dryRun">\u672a\u6267\u884c</strong></div>
        <div class="dxm-row"><span>op=1\u843d\u5e93</span><strong data-field="op1Persistence">\u672a\u9a8c\u8bc1</strong></div>
        <div class="dxm-row"><span>\u53d1\u5e03</span><strong data-field="publishStatus">\u672a\u6267\u884c</strong></div>
        <div class="dxm-row"><span>\u98ce\u9669\u6570</span><strong data-field="riskCount">0</strong></div>
        <input type="text" data-field="manualProductId" placeholder="\u53ef\u9009\uff1a\u624b\u52a8\u586b\u5199\u4ea7\u54c1 ID">
        <input type="text" data-field="amazonAsin" placeholder="\u53ef\u9009\uff1aAmazon ASIN/URL\uff1b\u4e0d\u586b\u5219\u53d6\u91c7\u96c6\u6279\u6b21\u7b2c1\u4e2a\u53ef\u7528\u5546\u54c1" value="${getAmazonSourceAsin()}">
        <input type="text" data-field="defaultShopId" placeholder="\u9ed8\u8ba4\u5e97\u94fa shopId" value="${getDefaultShopId()}">
        <input type="text" data-field="defaultPostageId" placeholder="\u9ed8\u8ba4\u7269\u6d41\u6a21\u677f postageId" value="${getDefaultPostageId()}">
        <input type="text" data-field="taskExchangeRate" placeholder="\u4efb\u52a1\u6c47\u7387\uff0c\u4f8b\u5982 7" value="${getTaskExchangeRate()}">
        <input type="text" data-field="taskPriceMultiplier" placeholder="\u4efb\u52a1\u500d\u7387\uff0c\u4f8b\u5982 5-20 \u586b 1.55" value="${getTaskPriceMultiplier()}">
        <input type="text" data-field="defaultSourcePrice" placeholder="Amazon 页面展示价 USD；货值按任务算式自动算" value="${getDefaultSourcePrice()}">
        <input type="text" data-field="defaultSupplyPrice" placeholder="已禁用：货值只由 Amazon 页面展示价 USD × 任务算式生成" value="" disabled>
        <input type="text" data-field="defaultWeight" placeholder="\u9ed8\u8ba4\u91cd\u91cf kg" value="${getDefaultWeightKg()}">
        <div class="dxm-mini-grid">
          <input type="text" data-field="defaultLengthIn" placeholder="\u957f inch" value="${getDefaultLengthIn()}">
          <input type="text" data-field="defaultWidthIn" placeholder="\u5bbd inch" value="${getDefaultWidthIn()}">
          <input type="text" data-field="defaultHeightIn" placeholder="\u9ad8 inch" value="${getDefaultHeightIn()}">
          <input type="text" data-field="defaultStock" placeholder="\u56fa\u5b9a\u5e93\u5b58 15" value="${getDefaultStock()}" disabled>
        </div>
        <div class="dxm-mini-grid">
          <input type="text" data-field="defaultLength" placeholder="\u957f cm" value="${getDefaultLength()}">
          <input type="text" data-field="defaultWidth" placeholder="\u5bbd cm" value="${getDefaultWidth()}">
          <input type="text" data-field="defaultHeight" placeholder="\u9ad8 cm" value="${getDefaultHeight()}">
        </div>
        <div class="dxm-actions">
          <button type="button" data-action="loadFirst">\u8bfb\u53d6\u5f53\u524d\u7b2c1\u6761</button>
          <button type="button" data-action="loadEdit">\u8bfb\u53d6 edit.json</button>
          <button type="button" data-action="dryRun">\u6784\u9020 dry-run</button>
          <button type="button" data-action="downloadZip" disabled>\u4e0b\u8f7d zip</button>
          <button type="button" data-action="downloadReport" disabled>\u4e0b\u8f7d\u62a5\u544a</button>
          <button type="button" data-action="downloadRunBundle" disabled>\u4e0b\u8f7drun\u62a5\u544a\u5305</button>
          <button type="button" data-action="learnSavePayload">\u5b66\u4e60\u771f\u5b9e\u4fdd\u5b58payload</button>
          <button type="button" data-action="saveCompletion" disabled>save.json op=1\u843d\u5e93</button>
          <button type="button" data-action="applyVisibleEditRules">\u5e94\u7528\u7f16\u8f91\u9875\u89c4\u5219</button>
          <button type="button" data-action="preflightSaveEdit">\u9884\u68c0\u5e76\u4fdd\u5b58</button>
          <button type="button" data-action="fillVisibleVariation">\u8bca\u65ad\u8865\u5f53\u524d\u9875\u53d8\u79cd</button>
        </div>
        <label><input type="checkbox" data-field="allowSubmit"> \u6211\u786e\u8ba4\u53ea\u63d0\u4ea4 1 \u4e2a\u6d4b\u8bd5\u4ea7\u54c1</label>
        <input type="text" data-field="submitCode" placeholder="\u771f\u5b9e\u63d0\u4ea4\u524d\u8f93\u5165 SUBMIT-ONE">
        <div class="dxm-actions">
          <button type="button" class="dxm-danger" data-action="submit" disabled>\u771f\u5b9e\u63d0\u4ea4 1 \u4e2a</button>
          <button type="button" class="dxm-danger" data-action="publishCurrentTest">\u53d1\u5e03\u5f53\u524d\u6d4b\u8bd5\u5546\u54c1</button>
        </div>
        <div class="dxm-log" data-field="log"></div>
      </div>
    `;
    document.documentElement.appendChild(panel);
    restorePosition(panel);
    makeDraggable(panel);

    panel.addEventListener('input', updateUi);
    panel.addEventListener('change', () => {
      const amazonAsin = panel.querySelector('[data-field="amazonAsin"]');
      const shopId = panel.querySelector('[data-field="defaultShopId"]');
      const postage = panel.querySelector('[data-field="defaultPostageId"]');
      const weight = panel.querySelector('[data-field="defaultWeight"]');
      const sourcePrice = panel.querySelector('[data-field="defaultSourcePrice"]');
      const supplyPrice = panel.querySelector('[data-field="defaultSupplyPrice"]');
      const stock = panel.querySelector('[data-field="defaultStock"]');
      const taskExchangeRate = panel.querySelector('[data-field="taskExchangeRate"]');
      const taskPriceMultiplier = panel.querySelector('[data-field="taskPriceMultiplier"]');
      const lengthIn = panel.querySelector('[data-field="defaultLengthIn"]');
      const widthIn = panel.querySelector('[data-field="defaultWidthIn"]');
      const heightIn = panel.querySelector('[data-field="defaultHeightIn"]');
      const length = panel.querySelector('[data-field="defaultLength"]');
      const width = panel.querySelector('[data-field="defaultWidth"]');
      const height = panel.querySelector('[data-field="defaultHeight"]');
      if (amazonAsin) localStorage.setItem(AMAZON_SOURCE_ASIN_KEY, amazonAsin.value.trim());
      if (shopId) localStorage.setItem(DEFAULT_SHOP_ID_KEY, shopId.value.trim());
      if (postage) localStorage.setItem(DEFAULT_POSTAGE_ID_KEY, postage.value.trim());
      if (weight) localStorage.setItem(DEFAULT_WEIGHT_KEY, weight.value.trim());
      if (sourcePrice) localStorage.setItem(DEFAULT_SOURCE_PRICE_KEY, sourcePrice.value.trim());
      if (supplyPrice) localStorage.setItem(DEFAULT_SUPPLY_PRICE_KEY, supplyPrice.value.trim());
      if (stock) localStorage.setItem(DEFAULT_STOCK_KEY, '15');
      if (taskExchangeRate) localStorage.setItem(TASK_EXCHANGE_RATE_KEY, taskExchangeRate.value.trim());
      if (taskPriceMultiplier) localStorage.setItem(TASK_PRICE_MULTIPLIER_KEY, taskPriceMultiplier.value.trim());
      if (lengthIn) localStorage.setItem(DEFAULT_LENGTH_IN_KEY, lengthIn.value.trim());
      if (widthIn) localStorage.setItem(DEFAULT_WIDTH_IN_KEY, widthIn.value.trim());
      if (heightIn) localStorage.setItem(DEFAULT_HEIGHT_IN_KEY, heightIn.value.trim());
      if (length) localStorage.setItem(DEFAULT_LENGTH_KEY, length.value.trim());
      if (width) localStorage.setItem(DEFAULT_WIDTH_KEY, width.value.trim());
      if (height) localStorage.setItem(DEFAULT_HEIGHT_KEY, height.value.trim());
      updateUi();
    });
    panel.addEventListener('click', async (event) => {
      const action = event.target && event.target.getAttribute('data-action');
      if (!action) return;
      try {
        if (action === 'loadFirst') await loadFirstDraftProduct();
        if (action === 'loadEdit') await loadEditJson();
        if (action === 'dryRun') await runDryRun();
        if (action === 'downloadZip' && state.zipBlob) downloadBlob(state.zipBlob, `choiceSave-${state.productId}.zip`);
        if (action === 'downloadReport' && state.report) downloadJson(state.report, `single-submit-report-${state.productId}.json`);
        if (action === 'downloadRunBundle') downloadRunBundle();
        if (action === 'learnSavePayload') await learnLatestCapturedSavePayload();
        if (action === 'saveCompletion') await saveCompletionOnly();
        if (action === 'applyVisibleEditRules') await applyVisibleEditPageRules({ manual: true });
        if (action === 'preflightSaveEdit') await saveEditPageWithPreflight();
        if (action === 'fillVisibleVariation') fillVisibleVariationFields();
        if (action === 'submit') await submitOne();
        if (action === 'publishCurrentTest') await publishCurrentTestProduct();
        if (action === 'collapse') {
          panel.classList.toggle('dxm-collapsed');
          localStorage.setItem(COLLAPSED_KEY, panel.classList.contains('dxm-collapsed') ? '1' : '0');
        }
      } catch (error) {
        log(`\u9519\u8bef\uff1a${error.message}`);
        console.error(`[${APP_NAME}]`, error);
      }
    });

    updateUi();
    try {
      writeReadonlyEditPreflightNode();
    } catch (error) {
      console.warn(`[${APP_NAME}] readonly preflight init failed`, error);
    }
    log('\u6d4b\u8bd5\u5668\u5df2\u52a0\u8f7d\u3002\u9ed8\u8ba4\u4e0d\u4f1a\u771f\u5b9e\u63d0\u4ea4\u3002');
    scheduleVisibleEditRulesAutoApply();
  }

  function restorePosition(panel) {
    try {
      const saved = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
      if (!saved) return;
      const maxLeft = Math.max(0, window.innerWidth - Math.max(panel.offsetWidth, 170));
      const maxTop = Math.max(0, window.innerHeight - Math.max(panel.offsetHeight, 36));
      const left = Math.min(Math.max(0, Number(saved.left) || 0), maxLeft);
      const top = Math.min(Math.max(0, Number(saved.top) || 0), maxTop);
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      if (left !== saved.left || top !== saved.top) {
        localStorage.setItem(POS_KEY, JSON.stringify({ left: Math.round(left), top: Math.round(top) }));
      }
    } catch (_) {
      // Ignore bad saved position.
    }
  }

  function makeDraggable(panel) {
    const header = panel.querySelector('.dxm-header');
    if (!header) return;
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    header.addEventListener('mousedown', (event) => {
      if (event.target && event.target.closest('button')) return;
      dragging = true;
      const rect = panel.getBoundingClientRect();
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      panel.style.left = `${rect.left}px`;
      panel.style.top = `${rect.top}px`;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      event.preventDefault();
    });

    document.addEventListener('mousemove', (event) => {
      if (!dragging) return;
      const maxLeft = window.innerWidth - panel.offsetWidth;
      const maxTop = window.innerHeight - panel.offsetHeight;
      const left = Math.min(Math.max(0, event.clientX - offsetX), Math.max(0, maxLeft));
      const top = Math.min(Math.max(0, event.clientY - offsetY), Math.max(0, maxTop));
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      localStorage.setItem(
        POS_KEY,
        JSON.stringify({
          left: Math.round(panel.getBoundingClientRect().left),
          top: Math.round(panel.getBoundingClientRect().top),
        })
      );
    });
  }

  function startPanel() {
    startVisibleEditRulesWatcher();
    try {
      createPanel();
    } catch (error) {
      console.error(`[${APP_NAME}] createPanel failed`, error);
    }
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (!document.getElementById(PANEL_ID)) {
        try {
          createPanel();
        } catch (error) {
          console.error(`[${APP_NAME}] createPanel retry failed`, error);
        }
      }
      if (document.getElementById(PANEL_ID) || attempts >= 30) window.clearInterval(timer);
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startPanel, { once: true });
  } else {
    startPanel();
  }
})();
