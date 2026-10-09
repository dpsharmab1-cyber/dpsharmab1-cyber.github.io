// The packaging library: every common pack type, grouped by what people are packing.
// A type either opens a parametric template at a sensible starting size
// (tpl + v) or is listed as "on request" (tpl: null) until its template exists.
// Many product types share one structure: an eyewear box is a tuck end box at
// 160 × 60 × 45 mm, a pizza box is a mailer at 300 × 300 × 40 mm.
//
// Codes: FEFCO = International Fibreboard Case Code (corrugated), ECMA = folding
// carton code. Sizes are typical starting points, not standards; check with your
// converter before ordering.

const T = (name, tpl, v, keys = '', extra = {}) => ({ name, tpl, v: v || null, keys, ...extra });

export const LIBRARY = [
  {
    id: 'boxes', name: 'Product boxes', blurb: 'Folding cartons for retail shelves.',
    look: { tpl: 'rte', v: { L: 70, W: 45, H: 130 }, color: '#c2956a', pattern: 'Kraft' },
    types: [
      T('Reverse tuck end box', 'rte', null, 'rte retail carton cosmetic serum supplement tea', { code: 'ECMA A20.20.03.01' }),
      T('Straight tuck end box', 'ste', null, 'ste carton', { code: 'ECMA A20.20.01.01' }),
      T('Polygon / hexagon box', 'hexbox', null, 'hexagon octagon gift candle'),
      T('Open tray', 'tray', null, 'tray display'),
      T('Sleeve', 'sleeve', null, 'sleeve wrap band'),
      T('Tea box', 'rte', { L: 75, W: 75, H: 120 }, 'tea chai green tea bags'),
      T('Soap box', 'ste', { L: 90, W: 60, H: 32 }, 'soap bar'),
      T('Candle box', 'rte', { L: 90, W: 90, H: 100 }, 'candle'),
      T('Toy box', 'rte', { L: 200, W: 80, H: 250 }, 'toy kids'),
      T('Crash-lock bottom box', null, null, 'crash lock auto bottom quick assembly', { code: 'ECMA A60.20' }),
      T('Snap-lock (1-2-3) bottom box', null, null, 'snap lock 123 bottom', { code: 'ECMA A40.20' }),
      T('Seal end carton', null, null, 'cereal seal end glued', { code: 'ECMA A15.20' }),
      T('Hanger tab box', null, null, 'hang tab euro slot peg hook'),
      T('Pillow box', null, null, 'pillow curved gift'),
      T('Gable box', null, null, 'gable handle lunch happy meal'),
      T('Window box', null, null, 'window pvc acetate see-through'),
      T('Briefcase / handle box', null, null, 'handle carry briefcase'),
      T('Matchbox drawer (tray + sleeve)', null, null, 'drawer slide matchbox'),
    ],
  },
  {
    id: 'mailers', name: 'Mailers & shipping', blurb: 'Corrugated boxes for e-commerce and transport.',
    look: { tpl: 'mailer', v: { L: 250, W: 180, H: 70 }, color: '#2547d0', pattern: 'Solid' },
    types: [
      T('Mailer box (roll-end tuck front)', 'mailer', null, 'mailer subscription ecommerce d2c unboxing pr box', { code: 'FEFCO 0427' }),
      T('Shipping carton (RSC)', 'rsc', null, 'regular slotted carton shipper corrugated', { code: 'FEFCO 0201' }),
      T('Apparel / T-shirt mailer', 'mailer', { L: 300, W: 250, H: 50 }, 'tshirt clothing apparel'),
      T('Book mailer', 'mailer', { L: 240, W: 170, H: 40 }, 'book'),
      T('Telescope box (lid and base)', 'sweet2pc', { L: 300, W: 250, H: 100, lidH: 60 }, 'telescope two piece', { code: 'FEFCO 0320' }),
      T('Poster tube', 'papertube', { D: 60, H: 450 }, 'poster drawing map'),
      T('Shipping label 4 × 6"', 'rectsticker', { W: 100, H: 150, r: 3 }, 'shipping label courier awb'),
      T('Half slotted box', null, null, 'hsc half slotted', { code: 'FEFCO 0200' }),
      T('Full overlap box', null, null, 'fol full overlap heavy', { code: 'FEFCO 0203' }),
      T('Book wrap', null, null, 'book wrap', { code: 'FEFCO 0410' }),
      T('Bottle shipper with dividers', null, null, 'wine shipper divider partition'),
      T('Padded / paper envelope', null, null, 'envelope padded bubble mailer'),
    ],
  },
  {
    id: 'food', name: 'Food & takeaway', blurb: 'Quick-service, cloud kitchen and bakery packs.',
    look: { tpl: 'fries', v: { L: 70, W: 35, Hf: 85, Hb: 115 }, color: '#e8553e', pattern: 'Solid' },
    types: [
      T('Fries box (scoop)', 'fries', null, 'french fries chips scoop wedges churros qsr'),
      T('Popcorn box', 'fries', { L: 82, W: 40, Hf: 95, Hb: 130, scoop: 10 }, 'popcorn cinema'),
      T('Pizza box', 'mailer', { L: 300, W: 300, H: 40 }, 'pizza 12 inch', { code: 'FEFCO 0426' }),
      T('Burger box (clamshell)', 'sweetbox', { L: 110, W: 110, H: 75 }, 'burger clamshell hinged'),
      T('Meal box (clamshell)', 'sweetbox', { L: 200, W: 150, H: 60 }, 'meal combo lunch hinged'),
      T('Food tray / boat', 'tray', { L: 150, W: 90, H: 40 }, 'food boat tray chaat nachos'),
      T('Hot dog tray', 'tray', { L: 180, W: 60, H: 40 }, 'hot dog frankie roll'),
      T('Cake box', 'sweet2pc', { L: 250, W: 250, H: 120, lidH: 120 }, 'cake bakery birthday'),
      T('Donut box', 'sweetbox', { L: 250, W: 250, H: 70 }, 'donut doughnut bakery'),
      T('Pastry / bakery tray', 'tray', { L: 220, W: 160, H: 45 }, 'pastry bakery cookies'),
      T('Paper coffee cup', 'curdcup', { D1: 80, D2: 56, Hc: 92 }, 'coffee tea chai paper cup hot drink 8 oz'),
      T('Sauce / dip cup', 'curdcup', { D1: 62, D2: 48, Hc: 35 }, 'sauce dip chutney portion cup'),
      T('Takeaway paper bag', 'sosbag', null, 'takeaway bag sos'),
      T('Cutlery pouch', 'sachet', { W: 60, H: 200 }, 'cutlery spoon napkin'),
      T('Noodle / Chinese pail', null, null, 'noodle chinese pail takeout'),
      T('Sandwich wedge', null, null, 'sandwich wedge triangle'),
      T('Cup carrier', null, null, 'cup holder carrier drinks'),
      T('Cupcake box with insert', null, null, 'cupcake muffin insert'),
    ],
  },
  {
    id: 'pouches', name: 'Pouches & flexibles', blurb: 'Laminated film and paper pouches.',
    look: { tpl: 'standup', v: { W: 140, H: 220, G: 80 }, color: '#e5a912', pattern: 'Solid' },
    types: [
      T('Stand-up pouch (doypack)', 'standup', null, 'doypack zipper coffee snacks pet food'),
      T('Flat 3-side seal pouch', 'sachet', null, 'three side seal flat pouch'),
      T('Sachet', 'sachet', { W: 70, H: 90 }, 'sachet shampoo ketchup sample'),
      T('Stick pack', 'sachet', { W: 30, H: 120 }, 'stick pack sugar coffee'),
      T('Pillow pack / flow wrap', 'chips', null, 'pillow flow wrap center seal'),
      T('Coffee pouch', 'standup', { W: 130, H: 210, G: 70 }, 'coffee beans valve'),
      T('Pet food pouch', 'standup', { W: 200, H: 300, G: 100 }, 'pet dog cat food'),
      T('Vacuum pouch', 'sachet', { W: 200, H: 300 }, 'vacuum meat cheese'),
      T('Side gusset bag', null, null, 'side gusset quad seal'),
      T('Flat bottom (box) pouch', null, null, 'flat bottom box pouch block bottom'),
      T('Spouted pouch', null, null, 'spout liquid baby food juice'),
      T('Shrink sleeve', null, null, 'shrink sleeve bottle'),
    ],
  },
  {
    id: 'bags', name: 'Paper bags', blurb: 'Shopping, grocery and gift bags.',
    look: { tpl: 'shopbag', v: { L: 260, W: 120, H: 330 }, color: '#c2956a', pattern: 'Kraft' },
    types: [
      T('Shopping bag (rope handles)', 'shopbag', null, 'shopping carry bag boutique retail'),
      T('SOS / grocery bag', 'sosbag', null, 'grocery sos square bottom'),
      T('Gift bag', 'shopbag', { L: 180, W: 80, H: 220 }, 'gift bag small'),
      T('Wine bag', 'shopbag', { L: 120, W: 90, H: 360 }, 'wine bottle bag'),
      T('Food delivery bag', 'sosbag', { L: 250, W: 150, H: 350 }, 'delivery swiggy zomato'),
      T('Pharmacy bag', 'sosbag', { L: 120, W: 60, H: 220 }, 'pharmacy chemist medicine bag'),
      T('Bread bag', 'sosbag', { L: 110, W: 70, H: 380 }, 'bread baguette'),
      T('Flat merchandise bag', null, null, 'flat merchandise envelope bag'),
      T('Non-woven bag', null, null, 'non woven fabric tote'),
    ],
  },
  {
    id: 'bottles', name: 'Bottles & jars', blurb: 'Labels on glass and plastic containers.',
    look: { tpl: 'bottle', v: { D: 72, bottleH: 280, labelH: 95 }, color: '#13288a', pattern: 'Solid' },
    types: [
      T('Wine bottle label', 'bottle', { D: 75, bottleH: 300, labelH: 100, labelY: 50 }, 'wine'),
      T('Beer bottle label', 'bottle', { D: 60, bottleH: 230, labelH: 80, labelY: 30 }, 'beer craft'),
      T('Juice / cold-press bottle', 'bottle', { D: 65, bottleH: 200, labelH: 85, cover: 80, labelY: 25 }, 'juice cold press kombucha'),
      T('Oil bottle label', 'bottle', { D: 70, bottleH: 280, labelH: 90, labelY: 40 }, 'oil cooking olive mustard'),
      T('Sauce bottle label', 'saucebottle', null, 'sauce ketchup squeeze mayo'),
      T('Honey jar label', 'jar', { D: 80, jarH: 110, labelH: 60 }, 'honey'),
      T('Pickle jar label', 'jar', { D: 90, jarH: 120, labelH: 70 }, 'pickle achar'),
      T('Jam / spread jar', 'jar', { D: 70, jarH: 90, labelH: 50 }, 'jam spread peanut butter'),
      T('Candle jar label', 'jar', { D: 80, jarH: 90, labelH: 50 }, 'candle jar'),
      T('Pill / supplement bottle', 'pillbottle', null, 'pill supplement vitamin capsule'),
      T('Protein tub label', 'pillbottle', { D: 125, bottleH: 190, labelH: 120, labelY: 18 }, 'protein whey tub'),
      T('Dropper / serum bottle', null, null, 'dropper serum essential oil'),
      T('Spray / pump bottle', null, null, 'spray pump sanitizer'),
      T('Bottle neck tag', null, null, 'neck tag collar hang tag'),
    ],
  },
  {
    id: 'cans', name: 'Cans & tins', blurb: 'Wrap labels for metal cans.',
    look: { tpl: 'canlabel', v: { D: 66, canH: 122, labelH: 96 }, color: '#e8553e', pattern: 'Solid' },
    types: [
      T('Beverage can 330 ml', 'canlabel', { D: 66, canH: 115, labelH: 90 }, 'soda can beverage energy drink'),
      T('Slim can 250 ml', 'canlabel', { D: 53, canH: 134, labelH: 110 }, 'slim can energy'),
      T('Food tin label', 'canlabel', { D: 73, canH: 110, labelH: 90 }, 'food tin canned'),
      T('Paint can label', 'canlabel', { D: 170, canH: 190, labelH: 160 }, 'paint bucket'),
      T('Aerosol / deodorant can', 'canlabel', { D: 50, canH: 190, labelH: 150 }, 'aerosol deodorant spray'),
      T('Tin box with lid', null, null, 'tin box metal'),
    ],
  },
  {
    id: 'tubes', name: 'Tubes & canisters', blurb: 'Squeeze tubes and paper canisters.',
    look: { tpl: 'squeeze', v: { D: 35, L: 140 }, color: '#2f9e6b', pattern: 'Solid' },
    types: [
      T('Squeeze tube', 'squeeze', null, 'squeeze tube laminate'),
      T('Toothpaste tube', 'squeeze', { D: 30, L: 170 }, 'toothpaste'),
      T('Face wash / cream tube', 'squeeze', { D: 35, L: 140 }, 'face wash cream lotion'),
      T('Ointment tube', 'squeeze', { D: 22, L: 100 }, 'ointment gel pharma'),
      T('Paper tube with lid', 'papertube', null, 'paper tube cylinder round box'),
      T('Tea canister', 'papertube', { D: 75, H: 120 }, 'tea canister round'),
      T('Chips canister', 'canister', null, 'chips can stackable'),
      T('Deodorant stick tube', 'papertube', { D: 55, H: 110 }, 'deodorant stick zero waste'),
      T('Lip balm tube', null, null, 'lip balm'),
    ],
  },
  {
    id: 'cups', name: 'Cups & containers', blurb: 'Paper cups, tubs and bowls.',
    look: { tpl: 'curdcup', v: { D1: 90, D2: 60, Hc: 110 }, color: '#2547d0', pattern: 'Solid' },
    types: [
      T('Coffee cup 8 oz', 'curdcup', { D1: 80, D2: 56, Hc: 92 }, 'coffee tea paper cup 8oz'),
      T('Coffee cup 12 oz', 'curdcup', { D1: 90, D2: 60, Hc: 110 }, 'coffee 12oz'),
      T('Ice-cream cup', 'curdcup', null, 'ice cream cup tub'),
      T('Soup bowl', 'curdcup', { D1: 115, D2: 90, Hc: 75 }, 'soup bowl salad'),
      T('Noodle cup', 'curdcup', { D1: 100, D2: 72, Hc: 110 }, 'instant noodle cup'),
      T('Sauce / portion cup', 'curdcup', { D1: 62, D2: 48, Hc: 35 }, 'portion cup dip'),
      T('Takeaway container', null, null, 'container rectangular food'),
      T('Cup lid sticker', 'roundsticker', { D: 80 }, 'lid sticker cup seal'),
    ],
  },
  {
    id: 'dairy', name: 'Dairy & milk', blurb: 'Milk, curd, butter and paneer.',
    look: { tpl: 'milkpouch', v: { W: 150, H: 220 }, color: '#2547d0', pattern: 'Solid' },
    types: [
      T('Milk pouch 500 ml', 'milkpouch', { W: 150, H: 220 }, 'milk doodh packet'),
      T('Milk pouch 1 L', 'milkpouch', { W: 180, H: 270 }, 'milk 1 litre'),
      T('Buttermilk / lassi pouch', 'milkpouch', { W: 110, H: 170 }, 'chaas buttermilk lassi 200 ml'),
      T('Curd cup', 'curdcup', { D1: 95, D2: 75, Hc: 70 }, 'curd dahi yogurt 400 g'),
      T('Butter carton', 'dairycarton', { L: 75, W: 45, H: 35 }, 'butter 100 g'),
      T('Paneer box', 'dairycarton', { L: 110, W: 60, H: 40 }, 'paneer cottage cheese 200 g'),
      T('Cheese slice carton', 'dairycarton', { L: 140, W: 75, H: 55 }, 'cheese'),
      T('Ghee jar label', 'jar', { D: 90, jarH: 110, labelH: 65 }, 'ghee'),
      T('Ice-cream tub', 'curdcup', { D1: 120, D2: 100, Hc: 85 }, 'ice cream tub family'),
      T('Gable-top milk carton', null, null, 'gable top milk carton'),
      T('Aseptic brick carton', null, null, 'tetra brick aseptic juice'),
    ],
  },
  {
    id: 'snacks', name: 'Snacks & confectionery', blurb: 'Chips, namkeen, biscuits and chocolate.',
    look: { tpl: 'chips', v: { W: 160, H: 230 }, color: '#e5a912', pattern: 'Solid' },
    types: [
      T('Chips bag', 'chips', null, 'chips crisps wafers'),
      T('Namkeen pouch', 'standup', { W: 160, H: 240, G: 80 }, 'namkeen bhujia mixture'),
      T('Chips canister', 'canister', null, 'stackable chips'),
      T('Biscuit / cookie carton', 'ste', { L: 200, W: 55, H: 75 }, 'biscuit cookie'),
      T('Chocolate bar sleeve', 'sleeve', { W: 150, H: 12, L: 70 }, 'chocolate bar wrapper sleeve'),
      T('Candy / toffee box', 'rte', { L: 80, W: 40, H: 110 }, 'candy toffee sweets'),
      T('Dry fruit pouch', 'standup', { W: 150, H: 230, G: 80 }, 'dry fruit nuts almonds'),
      T('Gum / mint sachet', 'sachet', { W: 40, H: 70 }, 'gum mint mouth freshener'),
      T('Chocolate gift box', 'sweet2pc', { L: 180, W: 120, H: 30, lidH: 25 }, 'chocolate gift'),
    ],
  },
  {
    id: 'sweets', name: 'Sweets, mithai & gifting', blurb: 'Festive boxes and premium gifting.',
    look: { tpl: 'sweet2pc', v: { L: 200, W: 150, H: 50 }, color: '#13288a', pattern: 'Solid' },
    types: [
      T('Sweet box (hinged lid)', 'sweetbox', null, 'mithai barfi peda halwai'),
      T('Two-piece sweet box', 'sweet2pc', null, 'premium lid base'),
      T('Kaju katli box 250 g', 'sweetbox', { L: 160, W: 110, H: 30 }, 'kaju katli'),
      T('Laddu box', 'sweetbox', { L: 200, W: 150, H: 65 }, 'laddu ladoo'),
      T('Dry fruit gift box', 'sweet2pc', { L: 250, W: 180, H: 60, lidH: 40 }, 'dry fruit diwali gift'),
      T('Diwali gift hamper', 'sweet2pc', { L: 350, W: 280, H: 100, lidH: 60 }, 'hamper festive corporate gift'),
      T('Rakhi / festive box', 'sweet2pc', { L: 180, W: 120, H: 40, lidH: 30 }, 'rakhi festival'),
      T('Polygon gift box', 'hexbox', null, 'hexagon gift'),
      T('Cookie tin', null, null, 'cookie tin metal'),
    ],
  },
  {
    id: 'health', name: 'Pharma & medical', blurb: 'Medicine cartons, devices and supplements.',
    look: { tpl: 'ste', v: { L: 120, W: 35, H: 70 }, color: '#ffffff', pattern: 'Solid' },
    types: [
      T('Tablet strip carton', 'ste', { L: 120, W: 35, H: 70 }, 'tablet strip medicine carton blister'),
      T('Syrup bottle carton', 'rte', { L: 55, W: 55, H: 135 }, 'syrup cough bottle'),
      T('Ointment tube carton', 'rte', { L: 30, W: 30, H: 120 }, 'ointment cream tube box'),
      T('Vial / injection box', 'rte', { L: 30, W: 30, H: 70 }, 'vial injection ampoule'),
      T('Syringe box', 'rte', { L: 40, W: 30, H: 160 }, 'syringe pen injector'),
      T('Medical device box', 'mailer', { L: 220, W: 160, H: 70 }, 'medical device glucometer bp monitor'),
      T('First-aid kit box', 'sweet2pc', { L: 220, W: 150, H: 70, lidH: 40 }, 'first aid kit'),
      T('Pill / supplement bottle', 'pillbottle', null, 'pill bottle supplement'),
      T('ORS / powder sachet', 'sachet', { W: 80, H: 110 }, 'ors sachet powder'),
      T('Surgical glove dispenser box', null, null, 'glove dispenser tissue'),
      T('Blister card', null, null, 'blister card'),
    ],
  },
  {
    id: 'beauty', name: 'Cosmetics & personal care', blurb: 'Beauty, fragrance and hygiene.',
    look: { tpl: 'rte', v: { L: 60, W: 60, H: 120 }, color: '#f6c7d3', pattern: 'Solid' },
    types: [
      T('Perfume box', 'rte', { L: 60, W: 60, H: 120 }, 'perfume fragrance attar'),
      T('Lipstick box', 'rte', { L: 25, W: 25, H: 85 }, 'lipstick'),
      T('Serum box', 'rte', { L: 40, W: 40, H: 120 }, 'serum dropper skincare'),
      T('Cream jar box', 'rte', { L: 70, W: 70, H: 60 }, 'cream jar moisturiser'),
      T('Nail polish box', 'rte', { L: 35, W: 35, H: 80 }, 'nail polish'),
      T('Soap sleeve', 'sleeve', { W: 95, H: 30, L: 65 }, 'soap sleeve band'),
      T('Face wash tube', 'squeeze', { D: 35, L: 150 }, 'face wash'),
      T('Shampoo bottle label', 'bottle', { D: 60, bottleH: 190, labelH: 90, cover: 50, labelY: 25 }, 'shampoo conditioner'),
      T('Hair oil bottle label', 'bottle', { D: 55, bottleH: 180, labelH: 80, labelY: 25 }, 'hair oil'),
      T('Cream jar label', 'jar', { D: 60, jarH: 45, labelH: 25, labelY: 8 }, 'cream jar label'),
      T('Sheet mask sachet', 'sachet', { W: 160, H: 220 }, 'sheet mask'),
      T('Deodorant can label', 'canlabel', { D: 50, canH: 190, labelH: 150 }, 'deodorant'),
    ],
  },
  {
    id: 'accessories', name: 'Eyewear, electronics & apparel', blurb: 'Boxes for accessories and devices.',
    look: { tpl: 'sweet2pc', v: { L: 170, W: 90, H: 50, lidH: 50 }, color: '#1b1d21', pattern: 'Solid' },
    types: [
      T('Eyeglass box', 'rte', { L: 160, W: 60, H: 45 }, 'eyeglass spectacles glasses eyewear optical'),
      T('Sunglasses box', 'rte', { L: 165, W: 65, H: 50 }, 'sunglasses shades'),
      T('Contact lens box', 'ste', { L: 70, W: 35, H: 60 }, 'contact lens'),
      T('Watch box', 'sweet2pc', { L: 100, W: 100, H: 70, lidH: 40 }, 'watch'),
      T('Jewellery box', 'sweet2pc', { L: 90, W: 90, H: 40, lidH: 30 }, 'jewellery jewelry ring earrings'),
      T('Phone box', 'sweet2pc', { L: 170, W: 90, H: 50, lidH: 50 }, 'phone mobile smartphone'),
      T('Earbuds box', 'sweet2pc', { L: 100, W: 100, H: 45, lidH: 45 }, 'earbuds earphones tws'),
      T('Charger / cable box', 'rte', { L: 70, W: 70, H: 100 }, 'charger cable adapter'),
      T('Shoe box', 'sweet2pc', { L: 330, W: 200, H: 120, lidH: 50 }, 'shoe footwear sneaker'),
      T('Apparel gift box', 'sweet2pc', { L: 350, W: 250, H: 80, lidH: 50 }, 'apparel clothing saree shirt'),
      T('Hang tag', null, null, 'hang tag swing tag clothing'),
      T('Rigid magnetic box', null, null, 'rigid magnetic premium'),
    ],
  },
  {
    id: 'labels', name: 'Labels & stickers', blurb: 'Die-cut stickers in any shape.',
    look: { tpl: 'roundsticker', v: { D: 80 }, color: '#e5a912', pattern: 'Solid' },
    types: [
      T('Round sticker', 'roundsticker', null, 'circle round sticker logo'),
      T('Oval label', 'ovalsticker', null, 'oval label'),
      T('Rectangle label', 'rectsticker', null, 'rectangle product label'),
      T('Square sticker', 'rectsticker', { W: 50, H: 50, r: 3 }, 'square sticker'),
      T('MRP / price sticker', 'rectsticker', { W: 50, H: 25, r: 2 }, 'mrp price barcode sticker'),
      T('Seal sticker', 'roundsticker', { D: 30 }, 'seal tamper thank you'),
      T('Jar lid sticker', 'roundsticker', { D: 70 }, 'lid top sticker'),
      T('Wrap label (bottle)', 'bottle', null, 'bottle label wrap'),
      T('Wrap label (jar)', 'jar', null, 'jar label wrap'),
      T('Wrap label (can)', 'canlabel', null, 'can label wrap'),
      T('Custom die-cut shape', null, null, 'custom shape die cut contour'),
    ],
  },
  {
    id: 'retail', name: 'Displays & retail', blurb: 'Point-of-sale and shelf-ready packs.',
    look: { tpl: 'tray', v: { L: 300, W: 200, H: 80 }, color: '#e5a912', pattern: 'Solid' },
    types: [
      T('Shelf-ready tray', 'tray', { L: 300, W: 200, H: 80 }, 'shelf ready tray srp'),
      T('Counter display box', null, null, 'counter display cdu pdq'),
      T('Floor display stand (FSDU)', null, null, 'floor stand fsdu'),
      T('Header card', null, null, 'header card bag topper'),
      T('Blister card', null, null, 'blister skin pack'),
      T('Clamshell (plastic)', null, null, 'clamshell pet'),
      T('Dump bin', null, null, 'dump bin'),
    ],
  },
];

export const ALL_TYPES = LIBRARY.flatMap((c) => c.types.map((t) => ({ ...t, cat: c.id, catName: c.name })));

export function typeLink(t, base = 'studio/') {
  if (!t.tpl) return null;
  const q = new URLSearchParams({ t: t.tpl });
  for (const [k, v] of Object.entries(t.v || {})) q.set(k, v);
  return `${base}#${q.toString()}`;
}

// every word must match the start of a word in the type's name, keys or category
export function searchTypes(query, types = ALL_TYPES) {
  const words = query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (!words.length) return types;
  const scored = [];
  for (const t of types) {
    const name = t.name.toLowerCase(), hay = ` ${name} ${t.keys} ${t.catName.toLowerCase()} `.replace(/[^a-z0-9 ]+/g, ' ');
    if (!words.every((w) => hay.includes(' ' + w))) continue;
    scored.push([t, words.reduce((s, w) => s + (name.includes(w) ? 2 : 1), 0) + (t.tpl ? 0.5 : 0)]);
  }
  return scored.sort((a, b) => b[1] - a[1]).map(([t]) => t);
}
