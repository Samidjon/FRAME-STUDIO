import type { DesignDocument } from "@/types/project";

/**
 * Malay copy for every example design, built only from what senitukang.com
 * states about the company: founded 2017, based in Malaysia, custom wood and
 * acrylic work, its four collections, its services and its contact details.
 * Text is keyed by layer name. The main title is not listed: it becomes the
 * company name in withSenitukangBrand.
 */

const WEB = "senitukang.com";
const PHONE = "011 5656 7811";
const CITY = "Batu Caves, Selangor";

export interface DesignCopy {
  name: string;
  description: string;
  text: Record<string, string>;
}

export const TEMPLATE_COPY: Record<string, DesignCopy> = {
  "swiss-konkrete": {
    name: "Mencipta Objek Berkarakter",
    description: "Poster pada grid modular: satu logo, nama besar dan jalur maklumat tiga lajur tentang Senitukang.",
    text: {
      "Index number": "01",
      "Meta — FS—001": "Sejak 2017",
      "Meta — Typografie · Raster ": "Kayu · Akrilik · Reka bentuk",
      "Meta — No. 01 / 2026": "Malaysia",
      Venue: "Hasil seni kayu\n& akrilik tersuai",
      Dates: "Berpangkalan di\nMalaysia",
      "Opening hours": `${PHONE}\n${CITY}`,
    },
  },
  "jp-ma-a4": {
    name: "Dicipta untuk Diingati",
    description: "Poster editorial A4: tajuk menegak, landskap dua warna dan dua lajur teks tentang kraf Senitukang.",
    text: {
      Issue: "Sejak 2017",
      Catalogue: "Malaysia",
      "Vertical title — 間の美学": "KAYU",
      Romanisation: "Dan akrilik",
      "Body — Japanese": "Senitukang mengubah kayu, akrilik dan idea menjadi objek yang dihargai.",
      "Body — English": "Daripada satu hadiah peribadi hingga koleksi lengkap untuk acara. Setiap karya dibuat dengan teliti dan bermakna.",
      Series: "Hasil seni\nTersuai\nKraf",
      Coordinates: `${CITY} — ${WEB}`,
    },
  },
  "modern-signal-story": {
    name: "Kami Cipta Cerita",
    description: "Poster cerita menegak: imej gelombang di atas, nama besar dan lencana sejak 2017.",
    text: {
      "Meta — FS—003": "Senitukang",
      "Meta — Broadcast 21.11.2026": "Hasil seni kayu & akrilik",
      "Badge label": "● Sejak 2017",
      Description: "Kami cipta cerita. Daripada idea kepada objek yang boleh dipegang dan dihargai.",
      "Meta — Hall 3 — Kanal": `${CITY}\n${PHONE}`,
    },
  },
  "modern-soft-shapes": {
    name: "Koleksi Perkahwinan",
    description: "Poster lembayung dengan bentuk gerbang dan tajuk serif untuk koleksi perkahwinan Senitukang.",
    text: {
      "Meta — FS—004 / Exhibition": "Koleksi perkahwinan",
      Room: "Sejak\n2017",
      "Info 1": "Papan alu-aluan",
      "Info 2": "Buku tetamu",
      "Info 3": "Hiasan kek",
      "Info 4": "Kad jemputan",
      "Meta — Curated by": `Tempah di\n${WEB}`,
    },
  },
  "exp-form-follows-feeling": {
    name: "Kayu, Akrilik, Cerita",
    description: "Perkataan bertindan dalam pelbagai skala, gema garis luar dan skrin titik pada latar jingga.",
    text: {
      "Word 2 — Form outline": "Kayu",
      "Word 3 — Follows": "Akrilik",
      "Word 4 — Feeling": "Cerita",
      "Rotated sidebar": "Idea · Bahan · Manusia · Hasil istimewa",
      Catalogue: "Sejak 2017",
      Specimen: "Hasil seni tersuai\nDibuat di Malaysia",
      Number: "№ 01",
    },
  },
  "swiss-raster-a4": {
    name: "Sejak 2017",
    description: "Poster A4 merah dan putih: angka 17 yang besar, foto pada grid dan empat koleksi Senitukang.",
    text: {
      "Meta — FS—002": "Sejak 2017",
      "Meta — Vortragsreihe": "Hasil seni kayu\n& akrilik tersuai",
      "Meta — Zürich": "Batu Caves\nSelangor\nMalaysia",
      Numeral: "17",
      "Intro text": "Daripada hadiah peribadi hingga perincian perkahwinan dan produk korporat, kami mengubah idea menjadi objek yang bermakna.",
      "Date 1": "01",
      "Meta — Abend 01 · 19:00": "Korporat",
      "Date 2": "02",
      "Meta — Abend 02 · 19:00": "Perkahwinan",
      "Date 3": "03",
      "Meta — Abend 03 · 19:00": "Gaya hidup",
      "Date 4": "04",
      "Meta — Abend 04 · 19:00": "Projek",
    },
  },
  "minimal-horizon-desktop": {
    name: "Tenang dan Teliti",
    description: "Kertas dinding desktop pada petua sepertiga: satu foto kecil, label sudut dan satu garis halus.",
    text: {
      "Meta — Fig. 01": "Sejak 2017",
      Catalogue: "Kayu & akrilik",
      Series: "Malaysia",
      Format: WEB,
      Coordinates: CITY,
    },
  },
  "album-orbital-drift": {
    name: "Koleksi Gaya Hidup",
    description: "Kulit persegi retro: planet dua warna, gelang orbit dan senarai produk kegunaan harian.",
    text: {
      Artist: "Produk peribadi",
      "Tracklist A": "01 Kotak\n02 Papan tanda\n03 Rantai kunci",
      "Tracklist B": "04 Alas cawan\n05 Pin\n06 Pen",
      Catalogue: `Sejak 2017\nMalaysia\n${WEB}`,
    },
  },
  "jp-tokyo-nocturne": {
    name: "Seni pada Waktu Malam",
    description: "Poster cerita malam: foto bokeh, tajuk menegak dan penanda vermilion tentang hasil seni Senitukang.",
    text: {
      Series: "Hasil seni / Sejak 2017",
      Catalogue: "Malaysia",
      "Vertical title — 東京夜景": "SENI",
      Timestamp: "Batu Caves\nSelangor\nMalaysia",
      "Caption — bilingual": "Mencipta objek berkarakter daripada kayu dan akrilik.",
      Coordinates: `${PHONE}\n${WEB}`,
    },
  },
  "event-acid-hour": {
    name: "Korporat & Acara",
    description: "Poster acara: imej bokeh bujur, tajuk paparan dan senarai perkhidmatan untuk majlis istimewa.",
    text: {
      Catalogue: "Korporat & acara",
      Venue: "Sejak 2017",
      "Line-up": "Tempahan pukal · Anugerah\nHadiah · Produk berjenama\nMajlis istimewa",
      "Date & time": `Minta sebut harga — ${PHONE}`,
      Tickets: WEB,
    },
  },
  "album-noise-floor": {
    name: "Ukiran Kayu & Akrilik",
    description: "Kulit gaya brutalis: foto skrin titik, tajuk besar, jalur maklumat hitam dan pelekat neon.",
    text: {
      "Info column 1": "Kayu\n01 Ukiran\n02 Kemasan\n03 Buatan tangan",
      "Info column 2": "Akrilik\n04 Ukiran\n05 Moden\n06 Kemas",
      "Info column 3": "Dibuat di\nBatu Caves\nSelangor",
      "Info column 4": `Sejak 2017\n${PHONE}`,
      "Sticker text": "Sejak\n2017",
    },
  },
  "minimal-stillness-square": {
    name: "Setiap Karya Bercerita",
    description: "Hantaran persegi dengan satu logo, satu perkataan dan ruang kosong yang disukat.",
    text: {
      Caption: "Setiap karya mempunyai cerita.",
      Index: "Sejak 2017",
      Year: "Malaysia",
      Credit: `Hasil seni kayu & akrilik — ${WEB}`,
    },
  },
  "event-design-symposium": {
    name: "Perkhidmatan Kami",
    description: "Poster biru moden: angka besar, logo dan jadual empat perkhidmatan Senitukang.",
    text: {
      "Edition numeral": "04",
      "Edition label": "Perkhidmatan kami",
      "Time 1": "01",
      "Session 1": "Reka bentuk tersuai",
      "Speaker 1": "Idea kepada produk",
      "Time 2": "02",
      "Session 2": "Ukiran kayu",
      "Speaker 2": "Buatan tangan",
      "Time 3": "03",
      "Session 3": "Ukiran akrilik",
      "Speaker 3": "Moden & kemas",
      "Time 4": "04",
      "Session 4": "Korporat & acara",
      "Speaker 4": "Tempahan pukal",
      Venue: "140 & 140A Jalan Jasa 5, Taman Jasa\n68100 Batu Caves, Selangor",
      Registration: `Sejak 2017\n${PHONE}`,
    },
  },
  "exp-a-to-z-a4": {
    name: "Huruf S dan T",
    description: "Spesimen A4 gelap: huruf besar S dan T bertembung, cakera krom dan lajur data tentang Senitukang.",
    text: {
      "Letter A": "S",
      "Letter Z — outline": "T",
      "Vertical caps": "KAYU\nDAN\nIDEA",
      Catalogue: "Sejak 2017",
      Specimen: "Hasil seni kayu & akrilik",
      "Spec 2": "Asas\nMalaysia",
      "Spec 3": "Bahan\nKayu, akrilik",
      "Spec 4": "Hubungi\n011 5656 7811",
    },
  },
  "photo-red-dune": {
    name: "Karya yang Terasa Peribadi",
    description: "Foto penuh dengan bingkai garis halus dan plat kapsyen kertas pada grid.",
    text: {
      Catalogue: "Karya pilihan",
      Camera: "Sejak 2017",
      "Plate number": "Karya 01",
      Location: `Karya yang terasa peribadi.\n${CITY}`,
    },
  },
  "photo-ridges-phone": {
    name: "Kertas Dinding Telefon",
    description: "Foto gunung monokrom untuk telefon: ruang jam di atas, bingkai halus dan kapsyen ringkas.",
    text: {
      Index: "№ 2017",
      Altitude: "Berpangkalan di Malaysia",
      Coordinates: "Kayu\nAkrilik",
    },
  },
  "abstract-form-function": {
    name: "Bentuk dan Bahan",
    description: "Persegi gaya Bauhaus: logo, segi empat dan segi tiga warna utama pada modul 4×4 dengan garis pepenjuru.",
    text: {
      Catalogue: "Sejak 2017\nKayu · Akrilik · Reka bentuk",
    },
  },
  "abstract-chromatic-field": {
    name: "Medan Warna",
    description: "Kertas dinding desktop: warna lembut, bulatan garis halus dan blok tajuk yang padat.",
    text: {
      Catalogue: "Sejak 2017",
      Subtitle: "Dibuat daripada idea anda",
    },
  },
  "arch-beton-brut": {
    name: "Profil Syarikat",
    description: "Poster A4: fasad monokrom, butiran gerbang, tajuk besar dan jadual maklumat syarikat.",
    text: {
      Catalogue: "Profil syarikat",
      Sheet: "Malaysia",
      "Spec label 1": "Syarikat",
      "Spec value 1": "Senitukang",
      "Spec label 2": "Sejak",
      "Spec value 2": "2017",
      "Spec label 3": "Bahan",
      "Spec value 3": "Kayu, akrilik",
      "Spec label 4": "Lokasi",
      "Spec value 4": "Batu Caves",
      Coordinates: `${PHONE}\n${WEB}`,
    },
  },
  "arch-thresholds": {
    name: "Papan Tanda & Projek",
    description: "Poster biru malam: fasad gerbang dua warna dan blok oker untuk tempahan khas berskala besar.",
    text: {
      Scale: "Sejak\n2017",
      Catalogue: "Projek",
      Series: "Tempahan khas / Papan tanda",
      Description: "Peta berbingkai, bahan persidangan, papan tanda dan paparan mengikut keperluan.",
      "Date & place": `${PHONE}\nBatu Caves`,
    },
  },
  "fashion-maison-cover": {
    name: "Majalah Senitukang",
    description: "Kulit majalah: krom cecair penuh, tajuk serif merentas lebar dan baris kulit tentang kraf.",
    text: {
      Issue: "Sejak 2017",
      Price: "Malaysia",
      "Cover line — lead": "Hadiah\nPeribadi",
      "Cover line — feature": "Objek yang bermakna, dibuat khas untuk anda",
      "Cover line — extra": "+ Koleksi perkahwinan\ndan korporat",
      "Barcode number": PHONE,
      Catalogue: "Kayu · Akrilik",
    },
  },
  "fashion-lookbook-ss27": {
    name: "Katalog Hadiah",
    description: "Pembuka katalog format cerita: imej gerbang dan bulatan, tajuk serif dan indeks koleksi.",
    text: {
      Season: "Katalog / Hadiah peribadi",
      Introduction: "Hadiah peribadi, perincian perkahwinan dan produk korporat, dibuat daripada kayu dan akrilik.",
      "Look index": "Koleksi\n01 — 04",
      Cities: "Korporat — Perkahwinan — Gaya hidup — Projek",
    },
  },
  "brutal-no-more-nice": {
    name: "Ada Projek?",
    description: "Poster padat dari tepi ke tepi, dengan blok data hitam dan cop jingga untuk permintaan sebut harga.",
    text: {
      Catalogue: "Sejak 2017 / Malaysia",
      "Thesis 1": "01 Perhatian pada butiran kecil.",
      "Thesis 2": "02 Setiap karya ada cerita.",
      "Thesis 3": "03 Ketepatan dan kesabaran.",
      "Thesis 4": "04 Buatan tangan mahir.",
      Footer: `Ada projek? Kongsikan idea anda — ${PHONE}`,
      "Stamp text": "Sejak\n2017",
    },
  },
  "brutal-build-break-repeat": {
    name: "Cipta Cerita",
    description: "Poster A4 kuning: tiga perkataan berat di antara garis tebal, blok skrin titik dan bar biru.",
    text: {
      "Word 2 — Break": "Cipta",
      "Word 3 — Repeat": "Cerita",
      Statement: "Daripada idea kosong kepada produk siap.",
      Details: `Sejak 2017\n${PHONE}\nBatu Caves`,
    },
  },
};

export interface ShowcaseCopy extends DesignCopy {
  kind: string;
  alt: string;
}

export const SHOWCASE_COPY: Record<string, ShowcaseCopy> = {
  swiss: {
    name: "Sistem Grid",
    kind: "Poster",
    description: "",
    alt: "Poster dengan logo Senitukang berwarna jingga dan nama syarikat bersaiz besar.",
    text: {
      "Nº 07": "Sejak\n2017",
      Internationale: "Hasil seni\nkayu & akrilik\ntersuai",
      Zürich: "Batu Caves\nSelangor\nMalaysia",
      "Form folgt": "Kami cipta\ncerita.",
      "14.03 —": "Korporat\nPerkahwinan",
      Kunstgewerbemuseum: "140 & 140A Jalan Jasa 5\n68100 Batu Caves",
      Eintritt: "Gaya hidup\nProjek",
    },
  },
  dune: {
    name: "Karya Bermakna",
    kind: "Editorial",
    description: "",
    alt: "Kulit editorial: bukit pasir merah di bawah langit biru kehijauan dengan tajuk menegak dan logo Senitukang.",
    text: {
      "Cat. Nº 0417—B": "Berpangkalan di Malaysia\nSejak 2017\nKayu & akrilik",
      砂丘の記憶: "KARYA",
      "第七号・二〇二七": "MALAYSIA",
      "Edition 07 — Rub al Khali": "Mencipta objek berkarakter",
      "2027 / 04": "Sejak 2017",
    },
  },
  album: {
    name: "Ukiran Akrilik",
    kind: "Kulit persegi",
    description: "",
    alt: "Kulit persegi: cakera krom skrin titik pada latar dua warna dengan nama Senitukang.",
    text: {
      "LP—012": "Sejak 2017\nMalaysia\nAkrilik",
      "Liquid State": "Ukiran Akrilik",
      "01 Mercury": "01 Anugerah\n02 Hadiah\n03 Papan tanda\n04 Rantai kunci",
    },
  },
  brutal: {
    name: "Kami Cipta Cerita",
    kind: "Poster tipografi",
    description: "",
    alt: "Poster jingga gaya brutalis dengan huruf besar Senitukang di atas jalur konkrit dua warna.",
    text: {
      "Manifesto Nº 3": "Kami cipta cerita\nHasil seni tersuai\nSejak 2017",
      "No decoration without functi": "Setiap karya mempunyai cerita",
      "FS—003": PHONE,
    },
  },
  ridges: {
    name: "Kertas Dinding Senitukang",
    kind: "Kertas dinding",
    description: "",
    alt: "Kertas dinding desktop bergambar banjaran gunung berlapis dengan nama dan logo Senitukang.",
    text: {
      "46.5583° N / 8.5611° E": "Batu Caves, Selangor, Malaysia",
      "Alt. 3 454 m": "Sejak 2017",
      "Frame/WP—03": `Kayu & akrilik\n${WEB}`,
    },
  },
  event: {
    name: "Korporat & Acara",
    kind: "Poster acara",
    description: "",
    alt: "Poster lembayung dengan logo Senitukang, tajuk menegak dan jadual perkhidmatan.",
    text: {
      "Vol. 09 — Fri 12.11.2027 — 1": "Sejak 2017 — Korporat & acara",
      "Free entry": "Malaysia",
      文字の夜: "IDEA",
      "19:00": "01",
      "Opening — The Grid as Ethic": "Reka bentuk tersuai",
      "Hall A": "Idea",
      "20:15": "02",
      "Type Specimens, Live": "Ukiran kayu & akrilik",
      "Hall B": "Bahan",
      "21:30": "03",
      "Night Composition": "Hasil istimewa",
      Roof: "Hasil",
    },
  },
  neon: {
    name: "Sejak 2017",
    kind: "Kertas dinding telefon",
    description: "",
    alt: "Kertas dinding telefon bokeh malam dengan angka 2017 dan logo Senitukang.",
    text: {
      "21:47": "2017",
      渋谷夜景: "SENI",
      "FS/PH—11   1179 × 2556": `Kayu & akrilik — ${WEB}`,
    },
  },
  type: {
    name: "Kajian Huruf",
    kind: "Kajian tipografi",
    description: "",
    alt: "Kajian tipografi: huruf besar St dengan garis dasar jingga dan logo Senitukang.",
    text: {
      "Typographic study Nº 12": "Kajian huruf / Senitukang",
      "Instrument Serif — Italic": "Sejak 2017",
      Ag: "St",
      Baseline: "Garis dasar",
      "Size 760 / Leading 1.00 / Tr": "Kraf satu butiran pada satu masa",
    },
  },
  fold: {
    name: "Hadiah Peribadi",
    kind: "Kempen",
    description: "",
    alt: "Hantaran kempen: kertas lipat putih dengan nama Senitukang dan tag jingga.",
    text: {
      "New collection": "Hadiah peribadi",
      "Spring / Summer 2027 — 12 ob": "Daripada hadiah peribadi hingga koleksi lengkap untuk acara",
      "FS—C04": "Sejak 2017",
    },
  },
  bloom: {
    name: "Dibuat daripada Idea Anda",
    kind: "Cerita kempen",
    description: "",
    alt: "Cerita kempen menegak: warna jingga dan lembayung di atas nama Senitukang.",
    text: {
      "Campaign — 2027": "Sejak 2017",
      "A seasonal identity built fr": "Dibuat daripada idea anda. Kongsikan idea, kami bantu merealisasikannya.",
      "FS/ST—09": PHONE,
      "1080 × 1920": "Malaysia",
    },
  },
};

/** Apply copy to a built design. Layer names that quote their old text follow the new text. */
export function applyCopy(doc: DesignDocument, copy: Pick<DesignCopy, "text">): DesignDocument {
  return {
    ...doc,
    layers: doc.layers.map((l) => {
      if (l.type !== "text") return l;
      const text = copy.text[l.name];
      if (text === undefined) return l;
      const first = text.split("\n")[0].slice(0, 28);
      const name = l.name.includes(" — ") ? `${l.name.split(" — ")[0]} — ${first}` : l.name === l.text.slice(0, 28) ? first : l.name;
      return { ...l, text, name };
    }),
  };
}
