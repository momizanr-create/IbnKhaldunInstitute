// ============================================================
// seed.js — Ibn Khaldun Institute Course Seed Script
// Run: node seed.js
// এই স্ক্রিপ্ট index.html এর সব হার্ডকোডেড কোর্স ডেটা MongoDB তে সংরক্ষণ করে
// ============================================================

require('dotenv').config();
const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  title: String, slug: { type: String, unique: true },
  category: String, instructor: String,
  price: Number, originalPrice: Number, discount: Number,
  description: String, shortDesc: String,
  thumbnail: String, previewVideo: String,
  duration: String, lessons: Number,
  students:  { type: Number, default: 0 },
  rating:    { type: Number, default: 4.5 },
  level:     { type: String, default: 'সকলের জন্য' },
  language:  { type: String, default: 'বাংলা' },
  tags: [String],
  curriculum: [{ sectionTitle: String, lessons: [{ title: String, duration: String, videoId: String, isFree: Boolean }] }],
  featured:  { type: Boolean, default: false },
  published: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
const Course = mongoose.model('Course', courseSchema);

// ────────────────────────────────────────────────────────────
// index.html থেকে নেওয়া সব কোর্স ডেটা
// ────────────────────────────────────────────────────────────
const SEED_COURSES = [
  {
    slug: 'quran-tajweed',
    title: 'Quran Tajweed: সহিহ তেলাওয়াতের সম্পূর্ণ গাইড',
    category: 'Quran',
    instructor: 'শায়েখ আব্দুল্লাহ',
    price: 1200,
    originalPrice: 2000,
    discount: 40,
    duration: '৩৬ ঘণ্টা',
    lessons: 10,
    students: 5200,
    rating: 4.8,
    level: 'শুরু',
    language: 'বাংলা',
    tags: ['quran', 'tajweed', 'arabic', 'recitation'],
    featured: true,
    published: true,
    thumbnail: 'https://images.unsplash.com/photo-1609599006353-e629aaabfeae?w=400&h=220&fit=crop',
    shortDesc: 'একদম শুরু থেকে কুরআনের শুদ্ধ তেলাওয়াত শিখুন।',
    description: 'এই কোর্সটি আপনাকে একদম শুরু থেকে কুরআনের শুদ্ধ তেলাওয়াত শেখাবে। মাখারিজুল হুরুফ থেকে শুরু করে মদ্দ, গুন্নাহ, নুন সাকিন ও তানওয়ীনের প্রতিটি বিধান সহজ ও বৈজ্ঞানিক পদ্ধতিতে ব্যাখ্যা করা হয়েছে।\n\nকোর্স শেষে আপনি সহিহভাবে কুরআন তেলাওয়াত করতে পারবেন এবং তাজওয়িদের মূল নিয়মগুলো আত্মস্থ করতে পারবেন।',
    curriculum: [
      {
        sectionTitle: 'ভূমিকা ও বুনিয়াদি পাঠ',
        lessons: [
          { title: 'কুরআন পরিচিতি ও গুরুত্ব',         duration: '১২:৩০', videoId: 'LXb3EKWsInQ', isFree: true  },
          { title: 'আরবি হরফ ও উচ্চারণ',               duration: '১৮:৪৫', videoId: 'YE7VzlLtp-4', isFree: true  },
          { title: 'মাখারিজুল হুরুফ: উচ্চারণস্থান',    duration: '২৪:০০', videoId: 'aircAruvnKk', isFree: false },
        ]
      },
      {
        sectionTitle: 'মদ্দ ও বিধানসমূহ',
        lessons: [
          { title: 'তাশদিদ ও সাকিন এর নিয়ম',          duration: '২১:১৫', videoId: 'WoZ7H3bGFiM', isFree: false },
          { title: 'মদ্দ: টানার নিয়মাবলি',             duration: '৩০:০০', videoId: 'tIeHLnjs5U8', isFree: false },
          { title: 'ওয়াকফ ও ইবতিদার নিয়ম',           duration: '২৮:৩০', videoId: 'OkmNXy7er84', isFree: false },
        ]
      },
      {
        sectionTitle: 'উচ্চতর তাজওয়িদ',
        lessons: [
          { title: 'ইযহার: পরিষ্কার উচ্চারণ',          duration: '২২:০০', videoId: 'spUNpyF58BY', isFree: false },
          { title: 'ইদগাম: মিলিয়ে পড়ার নিয়ম',        duration: '২৬:২০', videoId: 'qFLhGq0060w', isFree: false },
          { title: 'ইখফা: গোপন করার নিয়ম',             duration: '৩১:০০', videoId: 'X48VuDVv0do', isFree: false },
          { title: 'সূরা ফাতিহা বিশদ অনুশীলন',         duration: '৪৫:০০', videoId: 'Hc6J5rlzoec', isFree: false },
        ]
      }
    ]
  },

  {
    slug: 'seerah-nabi',
    title: 'সীরাতুন নবী ﷺ: নবীজির জীবনের পূর্ণাঙ্গ ইতিহাস',
    category: 'Islamic Studies',
    instructor: 'উস্তাদ ইউসুফ',
    price: 1500,
    originalPrice: 2500,
    discount: 40,
    duration: '৪৮ ঘণ্টা',
    lessons: 6,
    students: 4100,
    rating: 4.9,
    level: 'সকলের জন্য',
    language: 'বাংলা',
    tags: ['seerah', 'prophet', 'history', 'islamic'],
    featured: true,
    published: true,
    thumbnail: 'https://images.unsplash.com/photo-1564769625905-50e93615e769?w=400&h=220&fit=crop',
    shortDesc: 'রাসূলুল্লাহ ﷺ-এর সম্পূর্ণ জীবনী শিখুন।',
    description: 'রাসূলুল্লাহ ﷺ-এর জন্ম থেকে ইন্তেকাল পর্যন্ত পুরো জীবনকাল এই কোর্সে বিস্তারিতভাবে আলোচনা করা হয়েছে। মক্কি জীবন, হিজরত, মদিনার সমাজ গঠন, গাযওয়াত এবং ইসলামের বিজয়ের গল্প একসাথে পাবেন।\n\nএই কোর্সটি আপনাকে নবীজি ﷺ-এর জীবন থেকে শিক্ষা নিয়ে আধুনিক জীবনে প্রয়োগ করার অনুপ্রেরণা দেবে।',
    curriculum: [
      {
        sectionTitle: 'নবীজির ﷺ জীবন',
        lessons: [
          { title: 'নবীজির ﷺ জন্ম ও প্রাথমিক জীবন', duration: '১৫:০০', videoId: 'LXb3EKWsInQ', isFree: true  },
          { title: 'নবুওয়াতের সূচনা',                duration: '২২:৩০', videoId: 'YE7VzlLtp-4', isFree: true  },
          { title: 'মক্কার কঠিন সময়',                duration: '১৯:৪৫', videoId: 'aircAruvnKk', isFree: false },
          { title: 'হিজরত ও মদিনায় আগমন',           duration: '২৭:০০', videoId: 'bJAJjujoMMI', isFree: false },
          { title: 'বদর ও উহুদের যুদ্ধ',             duration: '৩৫:১৫', videoId: 'tIeHLnjs5U8', isFree: false },
          { title: 'মক্কা বিজয় ও শেষ জীবন',         duration: '৪০:০০', videoId: 'OkmNXy7er84', isFree: false },
        ]
      }
    ]
  },

  {
    slug: 'islamic-productivity',
    title: 'ইসলামিক প্রোডাক্টিভিটি: জীবন গোছানোর ইসলামিক পদ্ধতি',
    category: 'Islamic Studies',
    instructor: 'উস্তাদ রাশেদ',
    price: 800,
    originalPrice: 1500,
    discount: 47,
    duration: '২৪ ঘণ্টা',
    lessons: 5,
    students: 3200,
    rating: 4.7,
    level: 'সকলের জন্য',
    language: 'বাংলা',
    tags: ['productivity', 'islamic', 'lifestyle', 'time-management'],
    featured: false,
    published: true,
    thumbnail: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=400&h=220&fit=crop',
    shortDesc: 'কুরআন ও সুন্নাহর আলোকে উৎপাদনশীল জীবনযাপন শিখুন।',
    description: 'কুরআন ও সুন্নাহর আলোকে সময় ব্যবস্থাপনা, লক্ষ্য নির্ধারণ এবং উৎপাদনশীল জীবনযাপনের বৈজ্ঞানিক পদ্ধতি শিখুন। দুনিয়া ও আখিরাত উভয় ক্ষেত্রে সফল হওয়ার ইসলামিক রোডম্যাপ এই কোর্সে উপস্থাপন করা হয়েছে।',
    curriculum: [
      {
        sectionTitle: 'ইসলামিক সময় ব্যবস্থাপনা',
        lessons: [
          { title: 'ইসলামিক সময় ব্যবস্থাপনা',      duration: '১৪:০০', videoId: 'LXb3EKWsInQ', isFree: true  },
          { title: 'নিয়্যত ও লক্ষ্য নির্ধারণ',     duration: '১৮:০০', videoId: 'YE7VzlLtp-4', isFree: true  },
          { title: 'দৈনন্দিন রুটিন তৈরি',           duration: '২৩:৩০', videoId: 'aircAruvnKk', isFree: false },
          { title: 'মনোযোগ ও একাগ্রতা বৃদ্ধি',     duration: '২০:০০', videoId: 'WoZ7H3bGFiM', isFree: false },
          { title: 'প্রোক্রাস্টিনেশন থেকে মুক্তি', duration: '২৫:৪৫', videoId: 'tIeHLnjs5U8', isFree: false },
        ]
      }
    ]
  },

  {
    slug: 'sunnah-life',
    title: 'সুন্নাহর আলোয় জীবন: দৈনন্দিন ইসলামিক লাইফস্টাইল',
    category: 'Islamic Studies',
    instructor: 'উস্তাদ ইউসুফ',
    price: 1000,
    originalPrice: 1800,
    discount: 44,
    duration: '৩০ ঘণ্টা',
    lessons: 5,
    students: 2800,
    rating: 4.8,
    level: 'সকলের জন্য',
    language: 'বাংলা',
    tags: ['sunnah', 'lifestyle', 'daily-life', 'prophet'],
    featured: false,
    published: true,
    thumbnail: 'https://images.unsplash.com/photo-1585036156171-384164a8c675?w=400&h=220&fit=crop',
    shortDesc: 'নবীজির ﷺ সুন্নাহ মেনে জীবন গড়ুন।',
    description: 'ঘুম থেকে ওঠা থেকে রাতে শোওয়া পর্যন্ত নবীজির ﷺ সুন্নাহ মেনে জীবন গড়ার সহজ ও কার্যকর পদ্ধতি এই কোর্সে শেখানো হয়েছে। খাওয়া, পোশাক, পরিষ্কার-পরিচ্ছন্নতা থেকে শুরু করে পারিবারিক ও সামাজিক আচরণ — সবকিছুতে সুন্নাহর প্রয়োগ দেখানো হবে।',
    curriculum: [
      {
        sectionTitle: 'দৈনন্দিন সুন্নাহ',
        lessons: [
          { title: 'সুন্নাহর আলোয় সকাল শুরু',        duration: '১২:০০', videoId: 'LXb3EKWsInQ', isFree: true  },
          { title: 'খাদ্যাভ্যাস ও সুন্নাহ',          duration: '১৬:৩০', videoId: 'YE7VzlLtp-4', isFree: true  },
          { title: 'ঘুমের আদব ও দুআ',                duration: '১৪:৪৫', videoId: 'aircAruvnKk', isFree: false },
          { title: 'পোশাক ও পরিচ্ছন্নতার সুন্নাহ',  duration: '১৮:২০', videoId: 'WoZ7H3bGFiM', isFree: false },
          { title: 'সামাজিক আচরণে সুন্নাহ',          duration: '২২:০০', videoId: 'tIeHLnjs5U8', isFree: false },
        ]
      }
    ]
  },

  {
    slug: 'islamic-family',
    title: 'ইসলামিক পারিবারিক জীবন: সুখী সংসার গড়ার পথ',
    category: 'Islamic Studies',
    instructor: 'ড. ফারুক আহমেদ',
    price: 900,
    originalPrice: 1600,
    discount: 44,
    duration: '২০ ঘণ্টা',
    lessons: 5,
    students: 2100,
    rating: 4.7,
    level: 'সকলের জন্য',
    language: 'বাংলা',
    tags: ['family', 'marriage', 'parenting', 'islamic'],
    featured: false,
    published: true,
    thumbnail: 'https://images.unsplash.com/photo-1511895426328-dc8714191011?w=400&h=220&fit=crop',
    shortDesc: 'ইসলামের দৃষ্টিতে সুখী পারিবারিক জীবন গড়ুন।',
    description: 'ইসলামের দৃষ্টিতে বিবাহ, দাম্পত্য জীবন, সন্তান লালন-পালন এবং পারিবারিক সম্পর্কের গভীর আলোচনা এই কোর্সে রয়েছে। কুরআন ও হাদিসের আলোকে সুখী ও শান্তিময় পরিবার গঠনের ব্যবহারিক নির্দেশনা পাবেন।',
    curriculum: [
      {
        sectionTitle: 'পারিবারিক জীবনের ভিত্তি',
        lessons: [
          { title: 'ইসলামিক বিবাহের মূল্যবোধ',           duration: '১৬:০০', videoId: 'LXb3EKWsInQ', isFree: true  },
          { title: 'স্বামী-স্ত্রীর অধিকার ও দায়িত্ব',   duration: '২৪:৩০', videoId: 'YE7VzlLtp-4', isFree: true  },
          { title: 'সন্তান লালন-পালনের ইসলামিক পদ্ধতি', duration: '২৮:০০', videoId: 'aircAruvnKk', isFree: false },
          { title: 'পারিবারিক দ্বন্দ্ব নিরসন',           duration: '২০:১৫', videoId: 'WoZ7H3bGFiM', isFree: false },
          { title: 'বয়স্ক পিতামাতার সেবা',               duration: '১৯:৪৫', videoId: 'tIeHLnjs5U8', isFree: false },
        ]
      }
    ]
  },

  {
    slug: 'fiqhul-ibadat',
    title: 'ফিকহুল ইবাদাত: নামাজ, রোজা ও হজের বিধিবিধান',
    category: 'Fiqh',
    instructor: 'মুফতি আমীর',
    price: 1100,
    originalPrice: 2000,
    discount: 45,
    duration: '৪২ ঘণ্টা',
    lessons: 5,
    students: 3900,
    rating: 4.9,
    level: 'সকলের জন্য',
    language: 'বাংলা',
    tags: ['fiqh', 'salah', 'sawm', 'hajj', 'zakat'],
    featured: true,
    published: true,
    thumbnail: 'https://images.unsplash.com/photo-1554232456-8727aae0cfa4?w=400&h=220&fit=crop',
    shortDesc: 'নামাজ, রোজা, যাকাত ও হজের সঠিক বিধিবিধান শিখুন।',
    description: 'নামাজ, রোজা, যাকাত ও হজের সঠিক বিধিবিধান কুরআন ও হাদিসের আলোকে বিস্তারিতভাবে এই কোর্সে উপস্থাপন করা হয়েছে। ইবাদাতের মাসআলা-মাসায়েল থেকে শুরু করে সাধারণ ভুলগুলো সংশোধন পর্যন্ত সব বিষয় আলোচনা করা হবে।',
    curriculum: [
      {
        sectionTitle: 'ইবাদাতের বিধান',
        lessons: [
          { title: 'নামাজের ফরজ ও ওয়াজিব',        duration: '২০:০০', videoId: 'LXb3EKWsInQ', isFree: true  },
          { title: 'রোজার বিধিবিধান',              duration: '২৫:৩০', videoId: 'YE7VzlLtp-4', isFree: true  },
          { title: 'যাকাতের হিসাব ও নিসাব',        duration: '২২:০০', videoId: 'aircAruvnKk', isFree: false },
          { title: 'হজের ফরজ ও সুন্নাহ',           duration: '৩৫:১৫', videoId: 'WoZ7H3bGFiM', isFree: false },
          { title: 'পবিত্রতার বিস্তারিত বিধান',   duration: '২৭:৪৫', videoId: 'tIeHLnjs5U8', isFree: false },
        ]
      }
    ]
  },

  {
    slug: 'tafsir-quran',
    title: 'তাফসিরুল কুরআন: কুরআনের গভীর অর্থ ও ব্যাখ্যা',
    category: 'Quran',
    instructor: 'শায়েখ আব্দুল্লাহ',
    price: 1300,
    originalPrice: 2200,
    discount: 41,
    duration: '৫০ ঘণ্টা',
    lessons: 5,
    students: 2600,
    rating: 4.8,
    level: 'মধ্যবর্তী',
    language: 'বাংলা',
    tags: ['tafsir', 'quran', 'arabic', 'exegesis'],
    featured: false,
    published: true,
    thumbnail: 'https://images.unsplash.com/photo-1585036156171-384164a8c675?w=400&h=220&fit=crop',
    shortDesc: 'কুরআনের আয়াতসমূহের গভীর অর্থ ও তাফসির শিখুন।',
    description: 'কুরআনের আয়াতসমূহের গভীর অর্থ, পটভূমি (শানে নুযুল) এবং ক্লাসিকাল তাফসির পদ্ধতিতে ব্যাখ্যা-বিশ্লেষণ এই কোর্সের মূল বিষয়। ইবনে কাসির, তাবারি ও আধুনিক তাফসিরগ্রন্থের আলোকে কুরআনকে সহজে বোঝার পথ দেখানো হবে।',
    curriculum: [
      {
        sectionTitle: 'তাফসিরের ভূমিকা',
        lessons: [
          { title: 'তাফসির কী ও কেন শিখবেন',          duration: '১৩:৩০', videoId: 'LXb3EKWsInQ', isFree: true  },
          { title: 'সূরা ফাতিহার গভীর তাফসির',         duration: '৩২:০০', videoId: 'YE7VzlLtp-4', isFree: true  },
          { title: 'আয়াতুল কুরসির ব্যাখ্যা',          duration: '২৮:৪৫', videoId: 'aircAruvnKk', isFree: false },
          { title: 'সূরা ইয়াসিনের তাফসির',             duration: '৪৫:০০', videoId: 'WoZ7H3bGFiM', isFree: false },
          { title: 'সূরা মূলকের তাফসির',               duration: '৩৮:২০', videoId: 'tIeHLnjs5U8', isFree: false },
        ]
      }
    ]
  },

  {
    slug: 'islamic-history',
    title: 'ইসলামি সভ্যতার ইতিহাস: খলিফাদের স্বর্ণযুগ',
    category: 'Islamic Studies',
    instructor: 'উস্তাদ কামাল',
    price: 1400,
    originalPrice: 2400,
    discount: 42,
    duration: '৪৫ ঘণ্টা',
    lessons: 5,
    students: 1900,
    rating: 4.7,
    level: 'মধ্যবর্তী',
    language: 'বাংলা',
    tags: ['history', 'caliphate', 'civilization', 'golden-age'],
    featured: false,
    published: true,
    thumbnail: 'https://images.unsplash.com/photo-1564769625905-50e93615e769?w=400&h=220&fit=crop',
    shortDesc: 'ইসলামি সভ্যতার গৌরবময় ইতিহাস আবিষ্কার করুন।',
    description: 'খুলাফায়ে রাশেদিন থেকে আব্বাসি ও উমাইয়া খিলাফত পর্যন্ত ইসলামি সভ্যতার গৌরবময় ইতিহাস এই কোর্সে উপস্থাপন করা হয়েছে। মুসলিম বিজ্ঞানী, দার্শনিক ও শাসকদের অবদান এবং সেই যুগ থেকে বর্তমান প্রজন্মের জন্য শিক্ষাগ্রহণের পথ দেখানো হবে।',
    curriculum: [
      {
        sectionTitle: 'ইসলামি সভ্যতার ইতিহাস',
        lessons: [
          { title: 'ইসলামের উদয় ও বিস্তার',       duration: '১৮:০০', videoId: 'LXb3EKWsInQ', isFree: true  },
          { title: 'খোলাফায়ে রাশেদীনের যুগ',     duration: '৩৫:৩০', videoId: 'YE7VzlLtp-4', isFree: true  },
          { title: 'উমাইয়া খেলাফত',              duration: '২৮:০০', videoId: 'aircAruvnKk', isFree: false },
          { title: 'আব্বাসীয় স্বর্ণযুগ',          duration: '৩২:৪৫', videoId: 'WoZ7H3bGFiM', isFree: false },
          { title: 'উসমানী সাম্রাজ্য ও পতন',      duration: '৪০:০০', videoId: 'tIeHLnjs5U8', isFree: false },
        ]
      }
    ]
  },
];

async function seedCourses() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');

    let created = 0, skipped = 0;
    for (const courseData of SEED_COURSES) {
      const exists = await Course.findOne({ slug: courseData.slug });
      if (exists) {
        console.log(`⏭  Skip (already exists): ${courseData.title}`);
        skipped++;
      } else {
        await Course.create(courseData);
        console.log(`✅ Created: ${courseData.title}`);
        created++;
      }
    }

    console.log(`\n📊 সারসংক্ষেপ:`);
    console.log(`   ✅ নতুন তৈরি: ${created} কোর্স`);
    console.log(`   ⏭  আগে থেকে ছিল: ${skipped} কোর্স`);
    console.log(`   📦 মোট: ${SEED_COURSES.length} কোর্স`);
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 MongoDB disconnected');
  }
}

seedCourses();