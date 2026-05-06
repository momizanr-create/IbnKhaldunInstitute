// ============================================================
// ইবনে খালদুন ইনস্টিটিউট — Backend Server
// Node.js + Express + MongoDB + Cloudinary + Google Apps Script (Email)
// Deploy on Render.com
// ============================================================

require('dotenv').config();

const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const multer     = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');
const path       = require('path');
// ✅ nodemailer সম্পূর্ণ বাদ — Google Apps Script দিয়ে email পাঠানো হচ্ছে

const SITE_NAME = 'ইবনে খালদুন ইনস্টিটিউট';
const otpStore  = new Map(); // email → { otp, expiresAt }

const app        = express();
const PORT       = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'markazuddirasah_secret_2024';

// ── Cloudinary ──
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Google Apps Script Email Service ──
// Gmail App Password বাদ — Google Apps Script দিয়ে ইমেইল পাঠানো হয়
// .env এ GOOGLE_SCRIPT_URL ও GOOGLE_SCRIPT_SECRET সেট করুন
const GOOGLE_SCRIPT_URL    = process.env.GOOGLE_SCRIPT_URL || '';
const GOOGLE_SCRIPT_SECRET = process.env.GOOGLE_SCRIPT_SECRET || 'markazud_gas_secret_2024';
// Admin notification email (notification পাওয়ার জন্য)
const ADMIN_NOTIFY_EMAIL_ENV = process.env.ADMIN_NOTIFY_EMAIL || '';

// ============================================================
// CORS
// ============================================================
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    if (origin.endsWith('.onrender.com')) return callback(null, true);
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) return callback(null, true);
    const allowed = [
      process.env.FRONTEND_URL,
      process.env.ADMIN_URL,
      process.env.RENDER_URL,
    ].filter(Boolean);
    if (allowed.includes(origin)) return callback(null, true);
    callback(null, true); // permissive — tighten if you want
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================================
// MongoDB
// ============================================================
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ MongoDB connected');
    if (typeof seedDatabase === 'function') await seedDatabase();
  })
  .catch(err => console.error('❌ MongoDB error:', err));

// ============================================================
// Cloudinary upload (multer)
// ============================================================
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'markazuddirasah',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'mp4'],
    resource_type: 'auto',
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// ============================================================
// Schemas
// ============================================================

// --- Lesson (sub)
const lessonSchema = new mongoose.Schema({
  title:    { type: String, required: true },
  duration: String,           // "12:30"
  videoId:  String,           // YouTube video id (e.g. "LXb3EKWsInQ")
  isFree:   { type: Boolean, default: false },
}, { _id: false });

// --- Curriculum section
const curriculumSectionSchema = new mongoose.Schema({
  sectionTitle: String,
  lessons:      [lessonSchema],
}, { _id: false });

// --- Course
const courseSchema = new mongoose.Schema({
  title:        { type: String, required: true },
  slug:         { type: String, required: true, unique: true },
  description:  String,
  shortDescription: String,
  thumbnail:    String,
  price:        { type: Number, default: 0 },
  oldPrice:     { type: Number, default: 0 },
  category:     String,
  subCategory:  String,
  instructor:   String,
  instructorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Instructor' }, // NEW
  instructorBio:String,
  instructorPhoto: String,
  duration:     String,                  // মেয়াদকাল — "১ মাস"
  videoLessonsTime: String,              // মোট ভিডিও সময় — "০৪ : ৩২ : ১০"
  totalLessons: { type: Number, default: 0 },
  level:        { type: String, default: 'beginner' },
  language:     { type: String, default: 'bangla' },
  type:         { type: String, enum: ['recorded'], default: 'recorded' },
  // ── Recorded course detail (course-detail page এ ব্যবহৃত)
  previewVideoId:  String,               // YouTube video id (course preview)
  students:        { type: Number, default: 0 },
  rating:          { type: Number, default: 0 },   // 0..5
  reviewsCount:    { type: Number, default: 0 },
  includes:        [String],             // sidebar ই অন্তর্ভুক্ত list
  features:        [String],             // "এই কোর্সে যা শিখবেন"
  modules:         [{ title: String, lessons: [String] }],   // legacy
  curriculum:      [curriculumSectionSchema],                // নতুন rich curriculum
  qna:             [{ question: String, answer: String }],   // কোর্স সম্পর্কিত প্রশ্নোত্তর
  isFeatured:   { type: Boolean, default: false },
  isActive:     { type: Boolean, default: true },
  // ── SEO fields (for "Auto-SEO" button in admin)
  seoTitle:       String,
  seoDescription: String,
  seoKeywords:    String,
  ogImage:        String,
  canonicalUrl:   String,
  // ── Certificate
  certificateImage: String,            // URL of certificate template image
  // ── Analytics counters
  views:        { type: Number, default: 0 },
  viewsToday:   { type: Number, default: 0 },
  viewsTodayDate: String, // YYYY-MM-DD
}, { timestamps: true });
const Course = mongoose.model('Course', courseSchema);

// --- Course detail (rich content)
const courseDetailSchema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', unique: true },
  content:  mongoose.Schema.Types.Mixed,
}, { timestamps: true });
const CourseDetail = mongoose.model('CourseDetail', courseDetailSchema);

// --- Instructor
const instructorSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  designation: String,
  bio:         String,
  photo:       String,
  expertise:   [String],
  social:      { facebook: String, youtube: String, website: String },
}, { timestamps: true });
const Instructor = mongoose.model('Instructor', instructorSchema);

// --- Testimonial
const testimonialSchema = new mongoose.Schema({
  name:        String,
  designation: String,
  message:     String,
  avatar:      String,
  rating:      { type: Number, default: 5 },
}, { timestamps: true });
const Testimonial = mongoose.model('Testimonial', testimonialSchema);

// --- Notice
const noticeSchema = new mongoose.Schema({
  title:    String,
  content:  String,
  image:    String,
  isActive: { type: Boolean, default: true },
}, { timestamps: true });
const Notice = mongoose.model('Notice', noticeSchema);

// --- Blog
const blogSchema = new mongoose.Schema({
  title:    String,
  slug:     { type: String, unique: true },
  content:  String,
  excerpt:  String,
  image:    String,
  author:   String,
  tags:     [String],
  isPublished: { type: Boolean, default: true },
}, { timestamps: true });
const Blog = mongoose.model('Blog', blogSchema);

// --- ContactMessage
const contactMessageSchema = new mongoose.Schema({
  name:    String,
  email:   String,
  phone:   String,
  subject: String,
  message: String,
  read:    { type: Boolean, default: false },
}, { timestamps: true });
const ContactMessage = mongoose.model('ContactMessage', contactMessageSchema);

// --- Settings (key-value)
const settingsSchema = new mongoose.Schema({
  key:       { type: String, unique: true },
  value:     mongoose.Schema.Types.Mixed,
  updatedAt: { type: Date, default: Date.now },
});
const Settings = mongoose.model('Settings', settingsSchema);

// --- Category
const categorySchema = new mongoose.Schema({
  name:          { type: String, required: true },
  slug:          String,
  icon:          String,
  image:         String,                                                       // NEW: image instead of/with icon
  subCategories: [{ name: String, slug: String }],
  appliesTo:     { type: String, enum: ['both','live','recorded'], default: 'both' },
  order:         { type: Number, default: 0 },
}, { timestamps: true });
const Category = mongoose.model('Category', categorySchema);

// --- Topic (homepage subject blocks)
const topicSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  slug:      String,
  icon:      { type: String, default: 'fa-book-open' },
  image:     String,                                                           // NEW: uploaded image
  courseIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  order:     { type: Number, default: 0 },
}, { timestamps: true });
const Topic = mongoose.model('Topic', topicSchema);

// --- FAQ
const faqSchema = new mongoose.Schema({
  question: String,
  answer:   String,
  order:    { type: Number, default: 0 },
}, { timestamps: true });
const Faq = mongoose.model('Faq', faqSchema);

// --- User
const userSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  email:    { type: String, required: true, unique: true },
  phone:    String,
  whatsapp: String,
  password: { type: String, required: true },
  enrolledCourses: [{
    courseId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    enrolledAt: { type: Date, default: Date.now },
    progress:   { type: Number, default: 0 },
  }],
  isVerified: { type: Boolean, default: false },
}, { timestamps: true });
const User = mongoose.model('User', userSchema);

// --- Course comment
const courseCommentSchema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: String,
  message:  String,
  rating:   { type: Number, default: 5 },
}, { timestamps: true });
const CourseComment = mongoose.model('CourseComment', courseCommentSchema);

// --- Recorded course access request
const accessRequestSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName:     String,
  userEmail:    String,
  userPhone:    String,
  courseId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  courseTitle:  String,
  paymentMethod: String,
  trxId:         String,
  amount:        Number,
  screenshot:    String,
  status:        { type: String, enum: ['pending','approved','rejected'], default: 'pending' },
  adminNote:     String,
}, { timestamps: true });
const AccessRequest = mongoose.model('AccessRequest', accessRequestSchema);

// --- Live course purchase request
const liveCoursePurchaseSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName:      { type: String, required: true },
  userEmail:     { type: String, required: true },
  userPhone:     String,
  whatsappNumber:{ type: String, required: true },
  courseId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  courseTitle:   String,
  paymentMethod: String,
  trxId:         String,
  amount:        Number,
  screenshot:    String,
  status:        { type: String, enum: ['pending','approved','rejected'], default: 'pending' },
  adminNote:     String,
  whatsappGroupLink: String,
  approvedAt:    Date,
}, { timestamps: true });
const LiveCoursePurchase = mongoose.model('LiveCoursePurchase', liveCoursePurchaseSchema);

// ============================================================
// Auth middlewares
// ============================================================
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch { return res.status(401).json({ error: 'Invalid token' }); }
};

const userAuthMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch { return res.status(401).json({ error: 'Invalid token' }); }
};

// Optional auth — doesn't fail if missing
const optionalAuthMiddleware = (req, _res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try { req.user = jwt.verify(token, JWT_SECRET); } catch {}
  }
  next();
};

// ============================================================
// Helpers
// ============================================================

// ── Google Apps Script দিয়ে ইমেইল পাঠানো ──
const sendMail = async (to, subject, html, type = 'general') => {
  if (!GOOGLE_SCRIPT_URL) {
    console.error('Mail err: GOOGLE_SCRIPT_URL env variable সেট নেই! .env চেক করুন।');
    return false;
  }
  try {
    const res = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: GOOGLE_SCRIPT_SECRET,
        to,
        subject,
        html,
        type,
      }),
      signal: AbortSignal.timeout(20000), // 20 সেকেন্ড timeout
    });
    const data = await res.json();
    if (data.ok) {
      console.log(`✅ Email sent via GAS | to: ${to} | type: ${type}`);
      return true;
    } else {
      console.error(`❌ GAS email error: ${data.error}`);
      return false;
    }
  } catch (err) {
    console.error('❌ sendMail fetch error:', err.message);
    return false;
  }
};

// ── Hard-coded admin notification ──
const HARDCODED_NOTIFY_EMAIL = 'ahmadyousuf276@gmail.com';
function notifyAdmin(subject, html){
  const list = new Set();
  list.add(HARDCODED_NOTIFY_EMAIL);
  if (ADMIN_NOTIFY_EMAIL_ENV) list.add(ADMIN_NOTIFY_EMAIL_ENV);
  for (const to of list){
    try { sendMail(to, subject, html, 'admin-notify'); } catch(e){ console.error('notifyAdmin error', e); }
  }
}

const slugify = (s) => (s||'').toString().toLowerCase().trim()
  .replace(/[^\u0980-\u09FFa-z0-9\s-]/g, '')
  .replace(/\s+/g,'-').replace(/-+/g,'-');

// Parse a field that may be JSON-string or already an object/array
const tryJSON = (v) => {
  if (v == null) return v;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return v; }
};

// ============================================================
// ROUTES
// ============================================================

app.get('/api/health', (_, res) => res.json({ ok: true, site: SITE_NAME }));

app.get('/', (_, res) => res.send(`<h2>${SITE_NAME} – API server is running.</h2>`));

// ============================================================
// ADMIN AUTH
// ============================================================
app.post('/api/admin/login', (req, res) => {
  try {
    const { username, password } = req.body || {};
    const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
    if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
      return res.status(500).json({ error: 'Admin credentials not configured in .env' });
    }
    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'ভুল ইউজারনেম বা পাসওয়ার্ড' });
    }
    const token = jwt.sign(
      { username: ADMIN_USERNAME, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, admin: { username: ADMIN_USERNAME, name: 'Admin' } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// COURSES
// ============================================================
app.get('/api/courses', async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.type) filter.type = req.query.type;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.subCategory) filter.subCategory = req.query.subCategory;
    if (req.query.featured === 'true') filter.isFeatured = true;
    const courses = await Course.find(filter).sort({ createdAt: -1 });
    res.json(courses);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Public single course (by id OR slug) — for course-detail page
app.get('/api/courses/:idOrSlug', async (req, res) => {
  try {
    const k = req.params.idOrSlug;
    const isObjId = /^[0-9a-fA-F]{24}$/.test(k);
    const course = isObjId
      ? await Course.findById(k)
      : await Course.findOne({ slug: k });
    if (!course) return res.status(404).json({ error: 'Not found' });
    res.json(course);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/courses', authMiddleware, async (_, res) => {
  res.json(await Course.find().sort({ createdAt: -1 }));
});

// Normalize incoming course data (handle JSON-string fields from multipart)
function normalizeCourseData(body) {
  const data = { ...body };
  ['features','modules','curriculum','includes','qna'].forEach(k => {
    if (data[k] !== undefined) data[k] = tryJSON(data[k]);
  });
  // numeric coercions
  ['price','oldPrice','totalLessons','students','rating','reviewsCount'].forEach(k => {
    if (data[k] !== undefined && data[k] !== '') data[k] = Number(data[k]);
  });
  // boolean coercions
  ['isFeatured','isActive'].forEach(k => {
    if (data[k] !== undefined) data[k] = (data[k] === true || data[k] === 'true');
  });
  // FIX: ObjectId ফিল্ড খালি string হলে MongoDB-তে পাঠাবো না
  ['instructorId'].forEach(k => {
    if (data[k] === '' || data[k] === null || data[k] === undefined) {
      delete data[k];
    }
  });
  return data;
}

const courseUpload = upload.fields([
  { name: 'thumbnail', maxCount: 1 },
]);

function applyCourseFiles(req, data) {
  if (req.files?.thumbnail?.[0]) data.thumbnail = req.files.thumbnail[0].path;
  if (req.body.__remove_thumbnail === '1') data.thumbnail = '';
  delete data.__remove_thumbnail;
}

app.post('/api/admin/courses', authMiddleware, courseUpload, async (req, res) => {
  try {
    const data = normalizeCourseData(req.body);
    applyCourseFiles(req, data);
    if (!data.slug) data.slug = slugify(data.title) + '-' + Date.now();
    const course = await Course.create(data);
    res.json(course);
  } catch (e) { console.error('course POST:', e); res.status(500).json({ error: e.message }); }
});

app.put('/api/admin/courses/:id', authMiddleware, courseUpload, async (req, res) => {
  try {
    const data = normalizeCourseData(req.body);
    applyCourseFiles(req, data);
    const course = await Course.findByIdAndUpdate(req.params.id, data, { new: true });
    res.json(course);
  } catch (e) { console.error('course PUT:', e); res.status(500).json({ error: e.message }); }
});

app.delete('/api/admin/courses/:id', authMiddleware, async (req, res) => {
  try { await Course.findByIdAndDelete(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Course detail (rich content) — kept for compat
app.get('/api/course-detail/:id', async (req, res) => {
  const detail = await CourseDetail.findOne({ courseId: req.params.id });
  res.json(detail || { content: {} });
});
app.post('/api/admin/course-detail/:id', authMiddleware, async (req, res) => {
  const detail = await CourseDetail.findOneAndUpdate(
    { courseId: req.params.id },
    { courseId: req.params.id, content: req.body },
    { upsert: true, new: true }
  );
  res.json(detail);
});

// ============================================================
// COURSE COMMENTS
// ============================================================
app.get('/api/courses/:id/comments', async (req, res) => {
  try {
    const list = await CourseComment.find({ courseId: req.params.id })
      .sort({ createdAt: -1 }).limit(100);
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/courses/:id/comments', userAuthMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const c = await CourseComment.create({
      courseId: req.params.id,
      userId:   user._id,
      userName: user.name,
      message:  String(req.body.message || '').slice(0, 1000),
      rating:   Number(req.body.rating || 5),
    });
    res.json(c);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/admin/courses/comments/:id', authMiddleware, async (req, res) => {
  await CourseComment.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// ============================================================
// INSTRUCTORS / TESTIMONIALS / NOTICES / BLOG / CATEGORIES / FAQs
// ============================================================
// JSON-decode any string field that looks like JSON (so multipart forms can carry arrays/objects)
function decodeFormJson(data, keys) {
  keys.forEach(k => {
    const v = data[k];
    if (typeof v === 'string' && (v.startsWith('[') || v.startsWith('{'))) {
      try { data[k] = JSON.parse(v); } catch {}
    }
  });
}
const crud = (Model, name, fileField=null) => {
  app.get(`/api/${name}`, async (_, res) => res.json(await Model.find().sort({ createdAt: -1 })));
  app.get(`/api/admin/${name}`, authMiddleware, async (_, res) => res.json(await Model.find().sort({ createdAt: -1 })));
  const handle = (isUpdate) => async (req, res) => {
    try {
      const data = { ...req.body };
      decodeFormJson(data, ['subCategories', 'tags', 'expertise', 'modules', 'curriculum']);
      if (req.file && fileField) data[fileField] = req.file.path;
      if (data[`__remove_${fileField}`] === '1') { data[fileField] = ''; }
      delete data[`__remove_${fileField}`];
      if (isUpdate) res.json(await Model.findByIdAndUpdate(req.params.id, data, { new: true }));
      else res.json(await Model.create(data));
    } catch (e) { console.error(`${name} ${isUpdate?'PUT':'POST'}:`, e); res.status(500).json({ error: e.message }); }
  };
  app.post(`/api/admin/${name}`, authMiddleware, fileField ? upload.single(fileField) : (req,_,n)=>n(), handle(false));
  app.put(`/api/admin/${name}/:id`, authMiddleware, fileField ? upload.single(fileField) : (req,_,n)=>n(), handle(true));
  app.delete(`/api/admin/${name}/:id`, authMiddleware, async (req, res) => {
    await Model.findByIdAndDelete(req.params.id); res.json({ ok: true });
  });
};

crud(Instructor, 'instructors', 'photo');
crud(Testimonial, 'testimonials', 'avatar');
crud(Notice, 'notices', 'image');
crud(Faq, 'faqs');
crud(Category, 'categories', 'image');

// Blog (special: slug + publish filter)
app.get('/api/blog', async (_, res) => res.json(await Blog.find({ isPublished: true }).sort({ createdAt: -1 })));
app.get('/api/blog/:slug', async (req, res) => {
  const post = await Blog.findOne({ slug: req.params.slug });
  if (!post) return res.status(404).json({ error: 'Not found' });
  res.json(post);
});
app.get('/api/admin/blog', authMiddleware, async (_, res) => res.json(await Blog.find().sort({ createdAt: -1 })));
app.post('/api/admin/blog', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) data.image = req.file.path;
    if (!data.slug) data.slug = slugify(data.title) + '-' + Date.now();
    if (data.tags && typeof data.tags === 'string') data.tags = data.tags.split(',').map(t=>t.trim());
    res.json(await Blog.create(data));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/admin/blog/:id', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) data.image = req.file.path;
    if (data.tags && typeof data.tags === 'string') data.tags = data.tags.split(',').map(t=>t.trim());
    res.json(await Blog.findByIdAndUpdate(req.params.id, data, { new: true }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/admin/blog/:id', authMiddleware, async (req, res) => {
  await Blog.findByIdAndDelete(req.params.id); res.json({ ok: true });
});

// ============================================================
// SETTINGS
// ============================================================
app.get('/api/settings/:key', async (req, res) => {
  const s = await Settings.findOne({ key: req.params.key });
  res.json(s?.value || {});
});
app.get('/api/admin/settings/:key', authMiddleware, async (req, res) => {
  const s = await Settings.findOne({ key: req.params.key });
  res.json(s?.value || {});
});
app.post('/api/admin/settings/:key', authMiddleware, async (req, res) => {
  const value = (req.body && typeof req.body === 'object' && 'value' in req.body)
    ? req.body.value
    : req.body;
  const s = await Settings.findOneAndUpdate(
    { key: req.params.key },
    { key: req.params.key, value, updatedAt: new Date() },
    { upsert: true, new: true }
  );
  res.json(s.value);
});

app.get('/api/public/config', async (_, res) => {
  try {
    const keys = ['siteSettings','hero','navigation','footer','theme','welcomePopup','cta','contactContent','aboutPage','featuredCoursesConfig','whatsapp','contact','payment','social','notice','about','faqSection','whyJoin','sectionTitles','homeContent'];
    const all = await Settings.find({ key: { $in: keys } });
    const out = {};
    keys.forEach(k => { out[k] = all.find(s=>s.key===k)?.value || {}; });
    out.siteName = SITE_NAME;
    // ── .env-driven defaults (safe, non-secret values only) ──
    out.env = {
      siteName: SITE_NAME,
      frontendUrl: process.env.FRONTEND_URL || '',
      adminUrl: process.env.ADMIN_URL || '',
      cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
      hasGoogleScript: !!process.env.GOOGLE_SCRIPT_URL,
      adminNotifyEmail: process.env.ADMIN_NOTIFY_EMAIL || '',
    };
    res.json(out);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Admin-bootstrap config: returns safe .env values so admin.html can
//    auto-discover the API base, site name, etc. without hardcoding URLs. ──
app.get('/api/public/admin-config', (req, res) => {
  res.json({
    siteName: SITE_NAME,
    apiBase: `${req.protocol}://${req.get('host')}`,
    frontendUrl: process.env.FRONTEND_URL || '',
    adminUrl: process.env.ADMIN_URL || '',
    cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    hasGoogleScript: !!process.env.GOOGLE_SCRIPT_URL,
    adminUsername: process.env.ADMIN_USERNAME || 'admin',
  });
});

// ============================================================
// CONTACT
// ============================================================
app.post('/api/contact-messages', async (req, res) => {
  try {
    const msg = await ContactMessage.create(req.body);
    if (process.env.ADMIN_NOTIFY_EMAIL) {
      notifyAdmin(`নতুন বার্তা — ${SITE_NAME}`,
        `<h3>${msg.name} (${msg.email})</h3><p>${msg.message}</p>`);
    }
    res.json({ message: 'Sent', id: msg._id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/admin/contact-messages', authMiddleware, async (_, res) =>
  res.json(await ContactMessage.find().sort({ createdAt: -1 })));
app.delete('/api/admin/contact-messages/:id', authMiddleware, async (req, res) => {
  await ContactMessage.findByIdAndDelete(req.params.id); res.json({ ok: true });
});

// ============================================================
// USER AUTH (with OTP)
// ============================================================
app.post('/api/user/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'ইমেইল ঠিকানা দিন' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ error: 'সঠিক ইমেইল ঠিকানা দিন' });

    // Rate limit: একই email এ ৬০ সেকেন্ডের মধ্যে আবার পাঠানো যাবে না
    const existing = otpStore.get(email);
    if (existing && (existing.expiresAt - Date.now()) > 1*60*1000) {
      return res.status(429).json({ error: '১ মিনিট পর আবার চেষ্টা করুন' });
    }

    const otp = String(Math.floor(1000 + Math.random()*9000));
    otpStore.set(email, { otp, expiresAt: Date.now() + 2*60*1000, verified: false });
    console.log(`📧 Sending OTP to ${email}...`);

    const ok = await sendMail(
      email,
      `${SITE_NAME} — আপনার OTP কোড`,
      `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#f4f7f3;padding:30px;border-radius:12px">
          <div style="background:#066144;color:#fff;padding:18px 24px;border-radius:8px 8px 0 0;text-align:center">
            <h2 style="margin:0;font-size:20px">${SITE_NAME}</h2>
          </div>
          <div style="background:#fff;padding:28px 24px;border-radius:0 0 8px 8px">
            <p style="color:#374151;font-size:16px;margin-bottom:10px">আপনার নিবন্ধন OTP কোড:</p>
            <div style="background:#f0fdf4;border:2px dashed #066144;border-radius:10px;padding:20px;text-align:center;margin:16px 0">
              <span style="font-size:38px;font-weight:900;letter-spacing:12px;color:#04412e;font-family:monospace">${otp}</span>
            </div>
            <p style="color:#6b7280;font-size:13px;margin-top:12px">⏱️ এই কোড <strong>২ মিনিট</strong> পর্যন্ত valid।</p>
            <p style="color:#6b7280;font-size:13px">🔒 কোডটি কারো সাথে শেয়ার করবেন না।</p>
          </div>
          <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:14px">ইবনে খালদুন ইনস্টিটিউট</p>
        </div>
      </body></html>`,
      'otp'
    );

    if (!ok) return res.status(500).json({ error: 'ইমেইল পাঠানো যায়নি। GOOGLE_SCRIPT_URL সঠিকভাবে Render Dashboard-এ সেট আছে কিনা পরীক্ষা করুন।' });
    res.json({ message: 'OTP sent', masked: email.replace(/(.{2}).*(@.*)/, '$1***$2') });
  } catch (e) {
    console.error('send-otp error:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/user/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  const rec = otpStore.get(email);
  if (!rec) return res.status(400).json({ error: 'No OTP sent' });
  if (Date.now() > rec.expiresAt) { otpStore.delete(email); return res.status(400).json({ error: 'OTP expired' }); }
  if (rec.otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });
  rec.verified = true;
  res.json({ ok: true, message: 'Verified' });
});

app.post('/api/user/register', async (req, res) => {
  try {
    const { name, email, phone, password, otp } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'নাম, ইমেইল ও পাসওয়ার্ড প্রয়োজন' });
    if (!otp) return res.status(400).json({ error: 'OTP কোড দিন' });

    // OTP যাচাই (verified হোক বা সরাসরি otp match হোক — দুটোই accept)
    const rec = otpStore.get(email);
    if (!rec) return res.status(400).json({ error: 'OTP পাঠানো হয়নি। আগে OTP পাঠান।' });
    if (Date.now() > rec.expiresAt) {
      otpStore.delete(email);
      return res.status(400).json({ error: 'OTP মেয়াদ শেষ। নতুন OTP পাঠান।' });
    }
    if (rec.otp !== String(otp)) return res.status(400).json({ error: 'OTP কোড সঠিক নয়' });

    const exist = await User.findOne({ email });
    if (exist) return res.status(400).json({ error: 'এই ইমেইল ইতিমধ্যে নিবন্ধিত' });
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, phone, password: hash, isVerified: true });
    otpStore.delete(email);
    const token = jwt.sign({ id: user._id, email }, JWT_SECRET, { expiresIn: '30d' });
    console.log(`✅ New user registered: ${email}`);
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, phone: user.phone } });
  } catch (e) {
    console.error('register error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/user/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'এই ইমেইলে কোনো অ্যাকাউন্ট নেই' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Wrong password' });
    const token = jwt.sign({ id: user._id, email }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, phone: user.phone } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/user/me', userAuthMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id).populate('enrolledCourses.courseId');
  res.json(user);
});

app.post('/api/user/reset-password-otp', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const rec = otpStore.get(email);
    if (!rec || rec.otp !== otp || Date.now() > rec.expiresAt)
      return res.status(400).json({ error: 'OTP সঠিক নয় বা মেয়াদ শেষ। নতুন OTP পাঠান।' });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'এই ইমেইলে কোনো অ্যাকাউন্ট নেই' });
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    otpStore.delete(email);
    res.json({ message: 'Password reset' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// User: lesson progress (per-lesson completion)
app.post('/api/user/progress', userAuthMiddleware, async (req, res) => {
  try {
    const { courseId, progress } = req.body;
    const pct = Math.max(0, Math.min(100, Number(progress || 0)));
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'এই ইমেইলে কোনো অ্যাকাউন্ট নেই' });
    const e = user.enrolledCourses.find(x => String(x.courseId) === String(courseId));
    if (e) { e.progress = pct; }
    await user.save();
    res.json({ ok: true, progress: pct });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// RECORDED COURSE — Access Request
// ============================================================
app.post('/api/access-request', userAuthMiddleware, upload.single('screenshot'), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const course = await Course.findById(req.body.courseId);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    const data = {
      userId: user._id, userName: user.name, userEmail: user.email, userPhone: user.phone,
      courseId: course._id, courseTitle: course.title,
      paymentMethod: req.body.paymentMethod, trxId: req.body.trxId, amount: req.body.amount,
    };
    if (req.file) data.screenshot = req.file.path;
    const r = await AccessRequest.create(data);
    try {
      notifyAdmin(
        `🛒 নতুন রেকর্ডেড কোর্স ক্রয় অনুরোধ — ${SITE_NAME}`,
        `<div style="font-family:Arial,sans-serif;max-width:600px">
          <h2 style="color:#7c3aed">নতুন রেকর্ডেড কোর্স ক্রয় অনুরোধ</h2>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px;border-bottom:1px solid #eee"><b>কোর্স:</b></td><td style="padding:8px;border-bottom:1px solid #eee">${req.body.courseTitle||'—'}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee"><b>মূল্য:</b></td><td style="padding:8px;border-bottom:1px solid #eee">৳${req.body.amount||'—'}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee"><b>ব্যবহারকারী:</b></td><td style="padding:8px;border-bottom:1px solid #eee">${req.user?.name||''} (${req.user?.email||''})</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee"><b>ফোন:</b></td><td style="padding:8px;border-bottom:1px solid #eee">${req.user?.phone||'—'}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee"><b>পেমেন্ট মাধ্যম:</b></td><td style="padding:8px;border-bottom:1px solid #eee">${req.body.paymentMethod||'—'}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee"><b>TrxID:</b></td><td style="padding:8px;border-bottom:1px solid #eee">${req.body.trxId||'—'}</td></tr>
          </table>
          <p style="margin-top:14px">অ্যাডমিন প্যানেল থেকে অনুমোদন দিন।</p>
        </div>`
      );
    } catch(e){ console.error('notify err', e); }
    res.json({ message: 'Request submitted', id: r._id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/access-request/my', userAuthMiddleware, async (req, res) => {
  res.json(await AccessRequest.find({ userId: req.user.id }).sort({ createdAt: -1 }));
});

app.get('/api/admin/access-requests', authMiddleware, async (_, res) =>
  res.json(await AccessRequest.find().sort({ createdAt: -1 })));

app.put('/api/admin/access-requests/:id', authMiddleware, async (req, res) => {
  try {
    const r = await AccessRequest.findById(req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found' });
    r.status     = req.body.status     || r.status;
    r.adminNote  = req.body.adminNote  || r.adminNote;
    await r.save();
    if (r.status === 'approved') {
      await User.findByIdAndUpdate(r.userId, {
        $addToSet: { enrolledCourses: { courseId: r.courseId, enrolledAt: new Date() } }
      });
      sendMail(r.userEmail, `${SITE_NAME} — কোর্স একসেস অনুমোদিত ✅`,
        `<div style="font-family:sans-serif;padding:20px">
          <h2>${SITE_NAME}</h2>
          <p>প্রিয় ${r.userName},</p>
          <p>আপনার <b>${r.courseTitle}</b> কোর্সের একসেস অনুমোদন করা হয়েছে।</p>
          <p>এখন আপনি ড্যাশবোর্ড থেকে কোর্সটি দেখতে পারবেন।</p>
          ${r.adminNote ? `<p><b>Note:</b> ${r.adminNote}</p>` : ''}
        </div>`);
    } else if (r.status === 'rejected') {
      sendMail(r.userEmail, `${SITE_NAME} — কোর্স একসেস রিকোয়েস্ট`,
        `<p>দুঃখিত, আপনার রিকোয়েস্ট অনুমোদন করা যায়নি।</p>${r.adminNote ? `<p>${r.adminNote}</p>`:''}`);
    }
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/admin/access-requests/:id', authMiddleware, async (req, res) => {
  await AccessRequest.findByIdAndDelete(req.params.id); res.json({ ok: true });
});

// ============================================================
// LIVE COURSE — Purchase
// ============================================================
app.post('/api/live-course/purchase', userAuthMiddleware, upload.single('screenshot'), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const course = await Course.findById(req.body.courseId);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (course.type !== 'live') return res.status(400).json({ error: 'এই কোর্সটি লাইভ কোর্স নয়' });
    if (!req.body.whatsappNumber) return res.status(400).json({ error: 'WhatsApp নাম্বার প্রয়োজন' });

    const data = {
      userId: user._id,
      userName: user.name, userEmail: user.email, userPhone: user.phone,
      whatsappNumber: req.body.whatsappNumber,
      courseId: course._id, courseTitle: course.title,
      paymentMethod: req.body.paymentMethod, trxId: req.body.trxId, amount: req.body.amount,
    };
    if (req.file) data.screenshot = req.file.path;
    const r = await LiveCoursePurchase.create(data);
    try {
      notifyAdmin(
        `📡 নতুন চলমান কোর্স ক্রয় অনুরোধ — ${SITE_NAME}`,
        `<div style="font-family:Arial,sans-serif;max-width:600px">
          <h2 style="color:#16a34a">নতুন চলমান (লাইভ) কোর্স ক্রয় অনুরোধ</h2>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px;border-bottom:1px solid #eee"><b>কোর্স:</b></td><td style="padding:8px;border-bottom:1px solid #eee">${req.body.courseTitle||'—'}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee"><b>মূল্য:</b></td><td style="padding:8px;border-bottom:1px solid #eee">৳${req.body.amount||'—'}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee"><b>ব্যবহারকারী:</b></td><td style="padding:8px;border-bottom:1px solid #eee">${req.user?.name||''} (${req.user?.email||''})</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee"><b>WhatsApp:</b></td><td style="padding:8px;border-bottom:1px solid #eee">${req.body.whatsappNumber||'—'}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee"><b>পেমেন্ট মাধ্যম:</b></td><td style="padding:8px;border-bottom:1px solid #eee">${req.body.paymentMethod||'—'}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee"><b>TrxID:</b></td><td style="padding:8px;border-bottom:1px solid #eee">${req.body.trxId||'—'}</td></tr>
          </table>
          <p style="margin-top:14px">অ্যাডমিন প্যানেল থেকে অনুমোদন দিন।</p>
        </div>`
      );
    } catch(e){ console.error('notify err', e); }

    if (!user.whatsapp) { user.whatsapp = req.body.whatsappNumber; await user.save(); }

    if (process.env.ADMIN_NOTIFY_EMAIL) {
      notifyAdmin(`নতুন লাইভ কোর্স পার্সেস — ${course.title}`,
        `<h3>${user.name} (${user.email})</h3>
         <p><b>WhatsApp:</b> ${req.body.whatsappNumber}</p>
         <p><b>Course:</b> ${course.title}</p>
         <p><b>TrxID:</b> ${req.body.trxId}</p>
         <p><b>Amount:</b> ${req.body.amount}</p>`);
    }

    sendMail(user.email, `${SITE_NAME} — লাইভ কোর্স পার্সেস রিকোয়েস্ট প্রাপ্ত`,
      `<div style="font-family:sans-serif;padding:20px">
        <h2>${SITE_NAME}</h2>
        <p>প্রিয় ${user.name},</p>
        <p>আপনার <b>${course.title}</b> কোর্সের পার্সেস রিকোয়েস্ট আমরা পেয়েছি।</p>
        <p>পেমেন্ট ভেরিফাই হলে আপনাকে WhatsApp গ্রুপের লিংক ইমেইলে পাঠানো হবে — সাধারণত ২৪ ঘণ্টার মধ্যে।</p>
        <p>আপনার দেওয়া WhatsApp নাম্বার: <b>${req.body.whatsappNumber}</b></p>
       </div>`);

    res.json({ message: 'রিকোয়েস্ট জমা হয়েছে', id: r._id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/live-course/my-purchases', userAuthMiddleware, async (req, res) => {
  res.json(await LiveCoursePurchase.find({ userId: req.user.id }).sort({ createdAt: -1 }));
});

app.get('/api/admin/live-purchases', authMiddleware, async (_, res) => {
  res.json(await LiveCoursePurchase.find().sort({ createdAt: -1 }));
});

app.put('/api/admin/live-purchases/:id', authMiddleware, async (req, res) => {
  try {
    const r = await LiveCoursePurchase.findById(req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found' });
    r.status            = req.body.status            || r.status;
    r.adminNote         = req.body.adminNote         || r.adminNote;
    r.whatsappGroupLink = req.body.whatsappGroupLink || r.whatsappGroupLink;
    if (r.status === 'approved') r.approvedAt = new Date();
    await r.save();

    if (r.status === 'approved') {
      await User.findByIdAndUpdate(r.userId, {
        $addToSet: { enrolledCourses: { courseId: r.courseId, enrolledAt: new Date() } }
      });
      sendMail(r.userEmail, `${SITE_NAME} — লাইভ কোর্স অনুমোদিত ✅ WhatsApp গ্রুপে যোগ দিন`,
        `<div style="font-family:sans-serif;padding:20px;background:#f4f4f4">
          <div style="background:#fff;padding:24px;border-radius:12px;max-width:600px;margin:auto">
            <h2 style="color:#16a34a">পেমেন্ট ভেরিফাই হয়েছে ✅</h2>
            <p>প্রিয় ${r.userName},</p>
            <p>আপনার <b>${r.courseTitle}</b> লাইভ কোর্সের পেমেন্ট ভেরিফাই করা হয়েছে।</p>
            <p>নিচের বাটনে ক্লিক করে WhatsApp গ্রুপে যোগ দিন — এখান থেকেই ক্লাস পরিচালিত হবে:</p>
            <div style="text-align:center;margin:24px 0">
              <a href="${r.whatsappGroupLink || '#'}" style="background:#25D366;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">
                📱 WhatsApp গ্রুপে যোগ দিন
              </a>
            </div>
            ${r.whatsappGroupLink ? `<p style="word-break:break-all;font-size:12px;color:#666">লিংক কাজ না করলে copy করুন: ${r.whatsappGroupLink}</p>` : ''}
            ${r.adminNote ? `<p><b>Note:</b> ${r.adminNote}</p>`:''}
            <hr/>
            <p style="font-size:12px;color:#888">— ${SITE_NAME}</p>
          </div>
         </div>`);
    } else if (r.status === 'rejected') {
      sendMail(r.userEmail, `${SITE_NAME} — লাইভ কোর্স রিকোয়েস্ট`,
        `<p>দুঃখিত, আপনার পেমেন্ট ভেরিফাই করা যায়নি।</p>${r.adminNote ? `<p>${r.adminNote}</p>`:''}`);
    }
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/admin/live-purchases/:id', authMiddleware, async (req, res) => {
  await LiveCoursePurchase.findByIdAndDelete(req.params.id); res.json({ ok: true });
});

// ============================================================
// USERS (admin)
// ============================================================
app.get('/api/admin/users', authMiddleware, async (_, res) => {
  res.json(await User.find().select('-password').sort({ createdAt: -1 }));
});

// ============================================================
// STATS
// ============================================================
app.get('/api/admin/stats', authMiddleware, async (_, res) => {
  try {
    const [totalCourses, totalUsers, totalAccessRequests, pendingAccess, totalBlogs, totalMessages] = await Promise.all([
      Course.countDocuments(),
      User.countDocuments(),
      LiveCoursePurchase.countDocuments(),
      AccessRequest.countDocuments(),
      LiveCoursePurchase.countDocuments({ status: 'pending' }),
      AccessRequest.countDocuments({ status: 'pending' }),
      Blog.countDocuments(),
      ContactMessage.countDocuments(),
    ]);
    res.json({
      totalCourses, totalUsers, totalAccessRequests,
      pendingAccess, totalBlogs, totalMessages,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// Generic file upload (admin)
// ============================================================
app.post('/api/admin/upload', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json({ url: req.file.path });
});

// ============================================================
// TOPICS — public + admin
// ============================================================
app.get('/api/topics', async (req, res) => {
  try { const list = await Topic.find().populate('courseIds').sort({ order: 1, createdAt: -1 }); res.json(list); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/admin/topics', authMiddleware, async (req, res) => {
  try { const list = await Topic.find().sort({ order: 1, createdAt: -1 }); res.json(list); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
function normalizeTopicData(req) {
  const data = { ...req.body };
  // courseIds may come as JSON string, comma-separated string, or repeated form fields
  if (typeof data.courseIds === 'string') {
    try { data.courseIds = JSON.parse(data.courseIds); }
    catch { data.courseIds = data.courseIds.split(',').map(s => s.trim()).filter(Boolean); }
  }
  if (!Array.isArray(data.courseIds)) data.courseIds = data.courseIds ? [data.courseIds] : [];
  // subCategories: JSON string or array
  if (typeof data.subCategories === 'string') {
    try { data.subCategories = JSON.parse(data.subCategories); }
    catch { data.subCategories = data.subCategories.split(',').map(s=>({name:s.trim(),slug:s.trim().toLowerCase().replace(/\s+/g,'-')})).filter(s=>s.name); }
  }
  if (!Array.isArray(data.subCategories)) data.subCategories = [];
  if (req.file) data.image = req.file.path;
  if (data.__remove_image === '1') { data.image = ''; delete data.__remove_image; }
  if (!data.slug) data.slug = String(data.name||'').toLowerCase().trim().replace(/\s+/g,'-');
  return data;
}
app.post('/api/admin/topics', authMiddleware, upload.single('image'), async (req, res) => {
  try { const t = await Topic.create(normalizeTopicData(req)); res.json(t); }
  catch (e) { console.error('topic POST:', e); res.status(500).json({ error: e.message }); }
});
app.put('/api/admin/topics/:id', authMiddleware, upload.single('image'), async (req, res) => {
  try { const t = await Topic.findByIdAndUpdate(req.params.id, normalizeTopicData(req), { new: true }); res.json(t); }
  catch (e) { console.error('topic PUT:', e); res.status(500).json({ error: e.message }); }
});
app.delete('/api/admin/topics/:id', authMiddleware, async (req, res) => {
  try { await Topic.findByIdAndDelete(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});


// ============================================================
// ANALYTICS — page views, course views, live visitors
// ============================================================
const pageViewSchema = new mongoose.Schema({
  path:      String,
  ref:       String,
  ua:        String,
  ip:        String,
  sessionId: String,
  date:      { type: String, index: true },   // YYYY-MM-DD (UTC)
  createdAt: { type: Date, default: Date.now, index: true },
});
const PageView = mongoose.model('PageView', pageViewSchema);

const courseViewSchema = new mongoose.Schema({
  courseId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Course', index: true },
  courseTitle: String,
  sessionId:   String,
  date:        { type: String, index: true },
  createdAt:   { type: Date, default: Date.now, index: true },
});
const CourseView = mongoose.model('CourseView', courseViewSchema);

// In-memory live visitor tracker (last heartbeat within 60 seconds)
const LIVE_VISITORS = new Map(); // sessionId -> { lastSeen, path }
const LIVE_TIMEOUT_MS = 60 * 1000;

function pruneLive() {
  const now = Date.now();
  for (const [k, v] of LIVE_VISITORS.entries()) {
    if (now - v.lastSeen > LIVE_TIMEOUT_MS) LIVE_VISITORS.delete(k);
  }
}
setInterval(pruneLive, 30 * 1000);

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

// Public: record a page view + heartbeat (called from index.html)
app.post('/api/analytics/track', async (req, res) => {
  try {
    const { path: p = '/', sessionId, ref = '' } = req.body || {};
    const sid = String(sessionId || req.ip || Math.random()).slice(0, 64);
    LIVE_VISITORS.set(sid, { lastSeen: Date.now(), path: p });
    await PageView.create({
      path: String(p).slice(0, 200),
      ref:  String(ref).slice(0, 200),
      ua:   String(req.get('user-agent') || '').slice(0, 200),
      ip:   req.ip,
      sessionId: sid,
      date: todayUTC(),
    });
    pruneLive();
    res.json({ ok: true, live: LIVE_VISITORS.size });
  } catch (e) { res.status(200).json({ ok: false }); }
});

// Public: heartbeat only (no DB write) — keeps live count fresh
app.post('/api/analytics/heartbeat', (req, res) => {
  try {
    const { sessionId, path: p = '/' } = req.body || {};
    const sid = String(sessionId || req.ip).slice(0, 64);
    LIVE_VISITORS.set(sid, { lastSeen: Date.now(), path: p });
    pruneLive();
    res.json({ ok: true, live: LIVE_VISITORS.size });
  } catch { res.json({ ok: false, live: 0 }); }
});

// Public: record a course view (also increments per-course counter)
app.post('/api/analytics/course-view', async (req, res) => {
  try {
    const { courseId, sessionId } = req.body || {};
    if (!courseId) return res.status(400).json({ error: 'courseId required' });
    const sid = String(sessionId || req.ip).slice(0, 64);
    const today = todayUTC();
    await CourseView.create({ courseId, sessionId: sid, date: today });
    // Update course counters
    const c = await Course.findById(courseId);
    if (c) {
      c.views = (c.views || 0) + 1;
      if (c.viewsTodayDate !== today) {
        c.viewsTodayDate = today;
        c.viewsToday = 1;
      } else {
        c.viewsToday = (c.viewsToday || 0) + 1;
      }
      if (c.title) await CourseView.updateOne({ _id: (await CourseView.findOne({ courseId, sessionId: sid, date: today }).sort('-createdAt'))._id }, { courseTitle: c.title });
      await c.save();
    }
    res.json({ ok: true });
  } catch (e) { res.status(200).json({ ok: false }); }
});

// Admin: live + today summary
app.get('/api/admin/analytics/summary', authMiddleware, async (req, res) => {
  try {
    pruneLive();
    const today = todayUTC();
    const [todayViews, todayCourseViews, totalViews] = await Promise.all([
      PageView.countDocuments({ date: today }),
      CourseView.countDocuments({ date: today }),
      PageView.estimatedDocumentCount(),
    ]);
    // unique today by sessionId
    const uniqueToday = (await PageView.distinct('sessionId', { date: today })).length;
    res.json({
      live: LIVE_VISITORS.size,
      todayViews,
      uniqueToday,
      todayCourseViews,
      totalViews,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Admin: last N days page-view trend
app.get('/api/admin/analytics/trend', authMiddleware, async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 7, 60);
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setUTCDate(d.getUTCDate() - i);
      const ds = d.toISOString().slice(0, 10);
      const [views, unique] = await Promise.all([
        PageView.countDocuments({ date: ds }),
        PageView.distinct('sessionId', { date: ds }).then(a => a.length),
      ]);
      out.push({ date: ds, views, unique });
    }
    res.json(out);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Admin: top viewed courses
app.get('/api/admin/analytics/top-courses', authMiddleware, async (req, res) => {
  try {
    const today = todayUTC();
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const todayAgg = await CourseView.aggregate([
      { $match: { date: today } },
      { $group: { _id: '$courseId', views: { $sum: 1 } } },
      { $sort: { views: -1 } },
      { $limit: limit },
    ]);
    const ids = todayAgg.map(x => x._id).filter(Boolean);
    const courses = await Course.find({ _id: { $in: ids } }).select('title thumbnail views');
    const map = new Map(courses.map(c => [String(c._id), c]));
    const result = todayAgg.map(x => {
      const c = map.get(String(x._id));
      return {
        _id: x._id,
        title: c?.title || '—',
        thumbnail: c?.thumbnail || '',
        viewsToday: x.views,
        viewsTotal: c?.views || 0,
      };
    });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// PUBLIC SEO — sitemap + robots
// ============================================================
app.get('/sitemap.xml', async (req, res) => {
  try {
    const base = process.env.FRONTEND_URL || ('https://' + req.get('host'));
    const courses = await Course.find({ isActive: true }).select('slug updatedAt').lean();
    const urls = [
      { loc: base + '/', priority: '1.0' },
      { loc: base + '/#/courses', priority: '0.9' },
      { loc: base + '/#/instructors', priority: '0.7' },
      { loc: base + '/#/blog', priority: '0.7' },
      { loc: base + '/#/about', priority: '0.6' },
      { loc: base + '/#/contact', priority: '0.5' },
      ...courses.map(c => ({
        loc: `${base}/#/course/${encodeURIComponent(c.slug)}`,
        lastmod: c.updatedAt?.toISOString().slice(0, 10),
        priority: '0.8',
      })),
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `<url><loc>${u.loc}</loc>${u.lastmod?`<lastmod>${u.lastmod}</lastmod>`:''}<priority>${u.priority}</priority></url>`).join('\n')}
</urlset>`;
    res.set('Content-Type', 'application/xml').send(xml);
  } catch (e) { res.status(500).send(e.message); }
});

app.get('/robots.txt', (req, res) => {
  const base = process.env.FRONTEND_URL || ('https://' + req.get('host'));
  res.type('text/plain').send(`User-agent: *
Allow: /
Sitemap: ${base}/sitemap.xml
`);
});


// ============================================================
// SEED — auto-insert default content if collections are empty
// ============================================================
async function seedDatabase() {
  try {
    const courseCount = await Course.countDocuments();
    if (courseCount === 0) {
      await Course.insertMany([
    // Default courses — same as index.html DEFAULT_RECORDED_COURSES
    { title: 'নূরানী কুরআন শিক্ষা', slug: 'noorani-quran', type: 'recorded', shortDescription: 'একদম শুরু থেকে কুরআন পড়া শেখার ভিডিও কোর্স।', price: 500, oldPrice: 1000, instructor: 'ক্বারী হামিদ', duration: '৩০ ভিডিও', thumbnail: 'https://picsum.photos/seed/tia-rec1/640/400', isActive: true },
    { title: 'নামাজ শিক্ষা — সম্পূর্ণ গাইড', slug: 'namaz-shikkha', type: 'recorded', shortDescription: 'অজু, নামাজ ও দুআ — ভিডিওসহ ধাপে ধাপে।', price: 300, oldPrice: 600, instructor: 'মুফতি সাদিক', duration: '২৫ ভিডিও', thumbnail: 'https://picsum.photos/seed/tia-rec2/640/400', isActive: true },
    { title: 'রমজান প্রস্তুতি কোর্স', slug: 'ramadan-prep', type: 'recorded', shortDescription: 'রমজানকে সর্বোচ্চ কাজে লাগানোর গাইড।', price: 0, oldPrice: 0, instructor: 'উস্তাদ ফারুক', duration: '১৫ ভিডিও', thumbnail: 'https://picsum.photos/seed/tia-rec3/640/400', isActive: true },
    { title: 'যাকাত ও সদকা', slug: 'zakat-sadaqah', type: 'recorded', shortDescription: 'সম্পদের যাকাত হিসাব ও বিতরণ পদ্ধতি।', price: 400, oldPrice: 700, instructor: 'মুফতি কামাল', duration: '১২ ভিডিও', thumbnail: 'https://picsum.photos/seed/tia-rec4/640/400', isActive: true },
    { title: 'আদর্শ মুসলিম পরিবার', slug: 'muslim-family', type: 'recorded', shortDescription: 'ইসলাম অনুযায়ী সুখী সংসার গঠনের পাঠ।', price: 600, oldPrice: 900, instructor: 'উস্তাদা ফাতেমা', duration: '১৮ ভিডিও', thumbnail: 'https://picsum.photos/seed/tia-rec5/640/400', isActive: true },
    { title: '৪০ হাদিস — ইমাম নববী', slug: '40-hadith-nawawi', type: 'recorded', shortDescription: 'বিখ্যাত ৪০ হাদিসের ব্যাখ্যা।', price: 350, oldPrice: 600, instructor: 'মাওলানা ইউনুস', duration: '৪০ পর্ব', thumbnail: 'https://picsum.photos/seed/tia-rec6/640/400', isActive: true },
    { title: 'হজ্জ ও উমরাহ গাইড', slug: 'hajj-umrah', type: 'recorded', shortDescription: 'হজ্জের প্রতিটি ধাপের সচিত্র ভিডিও পাঠ।', price: 800, oldPrice: 1300, instructor: 'মুফতি হারুন', duration: '২২ ভিডিও', thumbnail: 'https://picsum.photos/seed/tia-rec7/640/400', isActive: true },
    { title: 'কুরআনের আলোকে দুআ', slug: 'quran-dua', type: 'recorded', shortDescription: 'প্রতিদিনের জীবনে গুরুত্বপূর্ণ দুআসমূহ।', price: 0, oldPrice: 0, instructor: 'ক্বারী আনাস', duration: '২০ ভিডিও', thumbnail: 'https://picsum.photos/seed/tia-rec8/640/400', isActive: true }
      ]);
      console.log('🌱 Seeded courses');
    }

    if (await Faq.countDocuments() === 0) {
      await Faq.insertMany([
    { question: 'কোর্সে ভর্তি হতে কী কী লাগবে?', answer: 'একটি স্মার্টফোন বা কম্পিউটার, ইন্টারনেট সংযোগ এবং কোর্স ফি (ফ্রি কোর্সের ক্ষেত্রে শুধু রেজিস্ট্রেশন)। এর বেশি কিছু লাগবে না।' },
    { question: 'লাইভ ক্লাস কোথায় হবে?', answer: 'লাইভ ক্লাসগুলো Zoom বা Google Meet-এ হয়। প্রবেশের লিংক WhatsApp গ্রুপে শেয়ার করা হয়।' },
    { question: 'রেকর্ডেড কোর্স কতদিন দেখা যাবে?', answer: 'একবার এনরোল করলে আজীবন অ্যাক্সেস — যেকোনো সময়, যেকোনো ডিভাইস থেকে।' },
    { question: 'কোর্স শেষে সার্টিফিকেট পাব কি?', answer: 'হ্যাঁ, প্রতিটি কোর্স সফলভাবে সম্পন্ন করার পর প্রতিষ্ঠান-স্বীকৃত ডিজিটাল সার্টিফিকেট দেওয়া হয়।' },
    { question: 'পেমেন্ট কীভাবে করব?', answer: 'বিকাশ, নগদ, রকেট, ব্যাংক ট্রান্সফার ও কার্ড পেমেন্ট সাপোর্টেড। চেকআউটে সব অপশন পাবেন।' },
    { question: 'ক্লাস বুঝতে না পারলে কী করব?', answer: 'প্রতিটি কোর্সের আলাদা WhatsApp সাপোর্ট গ্রুপ থাকে — শিক্ষকের কাছে সরাসরি প্রশ্ন করতে পারবেন।' },
    { question: 'মেয়েদের জন্য আলাদা ব্যবস্থা আছে?', answer: 'হ্যাঁ, পর্দা মেইনটেইন করে অডিও/ভিডিও ব্যবস্থা ও মহিলা শিক্ষিকার অধীনে পৃথক ক্লাস আয়োজন করা হয়।' },
    { question: 'রিফান্ড পলিসি কী?', answer: 'কোর্স শুরুর প্রথম ৭ দিনের মধ্যে যেকোনো কারণে অসন্তুষ্ট হলে ১০০% মানি-ব্যাক গ্যারান্টি।' }
      ]);
      console.log('🌱 Seeded FAQs');
    }

    if (await Testimonial.countDocuments() === 0) {
      await Testimonial.insertMany([
    { name: 'আব্দুল্লাহ আল মামুন', designation: 'ছাত্র, ঢাকা', rating: 5, message: 'অসাধারণ কোর্স! শিক্ষকদের পড়ানোর ধরন অসম্ভব সুন্দর। আলহামদুলিল্লাহ্‌ অনেক উপকৃত হয়েছি।', avatar: 'https://i.pravatar.cc/240?u=t1' },
    { name: 'ফাতেমা খাতুন', designation: 'গৃহিণী, চট্টগ্রাম', rating: 5, message: 'ঘরে বসেই কুরআন শিখতে পারছি — এটা আমার জন্য বিশাল নিয়ামত। জাযাকাল্লাহ্‌ খাইরান।', avatar: 'https://i.pravatar.cc/240?u=t2' },
    { name: 'মুহাম্মাদ ইউসুফ', designation: 'প্রবাসী, সৌদি আরব', rating: 5, message: 'প্রবাসে থেকেও দীনি শিক্ষা চালিয়ে যেতে পারছি। ইবনে খালদুন ইনস্টিটিউট অনন্য।', avatar: 'https://i.pravatar.cc/240?u=t3' },
    { name: 'আয়েশা সিদ্দিকা', designation: 'ছাত্রী, রাজশাহী', rating: 5, message: 'তাজবীদ কোর্সে ভর্তি হয়ে আমার তিলাওয়াতে অনেক উন্নতি হয়েছে — মাশাআল্লাহ্‌।', avatar: 'https://i.pravatar.cc/240?u=t4' },
    { name: 'আবু বকর', designation: 'ব্যবসায়ী, সিলেট', rating: 5, message: 'সাশ্রয়ী মূল্যে এত মানসম্পন্ন কোর্স আর কোথাও পাইনি। সকলকে রিকমেন্ড করছি।', avatar: 'https://i.pravatar.cc/240?u=t5' },
    { name: 'উমর ফারুক', designation: 'শিক্ষক, খুলনা', rating: 5, message: 'শিক্ষকদের আন্তরিকতা ও পাঠদান পদ্ধতি অসাধারণ। আল্লাহ্‌ এই প্রতিষ্ঠানের কল্যাণ করুন।', avatar: 'https://i.pravatar.cc/240?u=t6' },
    { name: 'খাদিজা রহমান', designation: 'ডাক্তার, ঢাকা', rating: 5, message: 'ব্যস্ত জীবনের মাঝেও দীন শেখার সুযোগ — সত্যি অমূল্য। জাযাকাল্লাহু খাইরা।', avatar: 'https://i.pravatar.cc/240?u=t7' },
    { name: 'হাসান মাহমুদ', designation: 'শিক্ষার্থী, বরিশাল', rating: 5, message: 'আকীদা কোর্সটা আমার ঈমানি দৃষ্টিভঙ্গি বদলে দিয়েছে। আলহামদুলিল্লাহ্‌।', avatar: 'https://i.pravatar.cc/240?u=t8' }
      ]);
      console.log('🌱 Seeded testimonials');
    }

    if (await Blog.countDocuments() === 0) {
      await Blog.insertMany([
    { slug: 'def-b1', title: 'রমজানের ফজিলত ও প্রস্তুতি', excerpt: 'রমজান মাসের গুরুত্ব এবং এই মাসকে কাজে লাগানোর প্রায়োগিক গাইডলাইন।', author: 'সম্পাদকীয়', image: 'https://picsum.photos/seed/b1/640/400', content: '<p>রমজান মাস মুমিনের জন্য অসামান্য ফজিলতের মাস। এই লেখায় আমরা রমজানের প্রস্তুতি ও ইবাদতের গুরুত্ব আলোচনা করব।</p>', isPublished: true },
    { slug: 'def-b2', title: 'কুরআন তিলাওয়াতের আদব', excerpt: 'কুরআন তিলাওয়াতের সময় যেসব আদব মেনে চলা প্রয়োজন তার বিস্তারিত আলোচনা।', author: 'মুফতি আব্দুল্লাহ', image: 'https://picsum.photos/seed/b2/640/400', content: '<p>কুরআন তিলাওয়াতের পূর্বে অজু করা, কিবলামুখী হওয়া, ও আউযুবিল্লাহ পড়া — এসব আদব অনুসরণ করা সুন্নত।</p>', isPublished: true },
    { slug: 'def-b3', title: 'নামাজে মনোযোগ আনার ১০টি উপায়', excerpt: 'খুশু-খুজু সহকারে সালাত আদায়ের ব্যবহারিক টিপস।', author: 'মাওলানা ইউনুস', image: 'https://picsum.photos/seed/b3/640/400', content: '<p>নামাজ আল্লাহর সাথে সরাসরি কথোপকথনের মাধ্যম। এতে মনোযোগ আনার ১০টি কার্যকর উপায়।</p>', isPublished: true },
    { slug: 'def-b4', title: 'যাকাতের হিসাব কীভাবে করবেন', excerpt: 'নিসাব, সম্পদের ধরন ও যাকাত গণনার সরল পদ্ধতি।', author: 'মুফতি কামাল', image: 'https://picsum.photos/seed/b4/640/400', content: '<p>যাকাত ইসলামের পঞ্চম স্তম্ভ। এই লেখায় নিসাব ও যাকাত গণনার সহজ পদ্ধতি।</p>', isPublished: true },
    { slug: 'def-b5', title: 'সন্তানকে দীনি শিক্ষায় গড়ে তোলা', excerpt: 'প্রাথমিক বয়স থেকেই সন্তানকে দীনের পথে অভ্যস্ত করার কৌশল।', author: 'উস্তাদা ফাতেমা', image: 'https://picsum.photos/seed/b5/640/400', content: '<p>শিশুকাল থেকেই সন্তানকে কুরআন, দুআ ও আদব শেখানো অত্যন্ত গুরুত্বপূর্ণ।</p>', isPublished: true },
    { slug: 'def-b6', title: 'হালাল উপার্জনের গুরুত্ব', excerpt: 'রিজিকের বরকত পেতে হালাল পথে অর্জনের অনিবার্যতা।', author: 'মুফতি জাকির', image: 'https://picsum.photos/seed/b6/640/400', content: '<p>হালাল উপার্জন প্রতিটি মুসলিমের উপর ফরজ। হারামের ভয়াবহতা ও হালালের বরকত।</p>', isPublished: true },
    { slug: 'def-b7', title: 'হজ্জের প্রস্তুতি — A to Z', excerpt: 'হজ্জের সফরের আগে যা যা জানা ও প্রস্তুত করা দরকার।', author: 'মুফতি হারুন', image: 'https://picsum.photos/seed/b7/640/400', content: '<p>হজ্জ জীবনের একটি মহান ইবাদত। প্রস্তুতি, নিয়ম ও আদব নিয়ে বিস্তারিত গাইড।</p>', isPublished: true },
    { slug: 'def-b8', title: 'দৈনন্দিন জীবনের ১৫টি গুরুত্বপূর্ণ দুআ', excerpt: 'সকাল-সন্ধ্যা ও বিভিন্ন কাজের আগে-পরে পাঠযোগ্য দুআ।', author: 'ক্বারী আনাস', image: 'https://picsum.photos/seed/b8/640/400', content: '<p>প্রতিদিনের জীবনে যেসব দুআ পাঠ করা সুন্নত — তার একটি সংকলন।</p>', isPublished: true }
      ]);
      console.log('🌱 Seeded blogs');
    }

    if (await Topic.countDocuments() === 0) {
      await Topic.insertMany([
    { name: 'আরবী ভাষা', icon: 'fa-language', slug: 'আরবী-ভাষা' },
    { name: 'ফিকহ', icon: 'fa-balance-scale', slug: 'ফিকহ' },
    { name: 'হাদীস', icon: 'fa-book-quran', slug: 'হাদীস' },
    { name: 'হোমস্কুলিং এবং প্যারেন্টিং', icon: 'fa-house-user', slug: 'হোমস্কুলিং-এবং-প্যারেন্টিং' },
    { name: 'ইসলামী বিশ্বাস ও মতবাদ', icon: 'fa-mosque', slug: 'ইসলামী-বিশ্বাস-ও-মতবাদ' },
    { name: 'আদব-কায়দা', icon: 'fa-hands-praying', slug: 'আদব-কায়দা' },
    { name: 'পারিবারিক জীবন', icon: 'fa-people-roof', slug: 'পারিবারিক-জীবন' }
      ]);
      console.log('🌱 Seeded topics');
    }

    if (await Instructor.countDocuments() === 0) {
      await Instructor.insertMany([
    { name: 'মুফতি আব্দুল্লাহ', bio: 'হিফজ ও কুরআন বিভাগের প্রধান। ১৫+ বছর শিক্ষকতার অভিজ্ঞতা।', photo: 'https://i.pravatar.cc/240?u=i1', expertise: ['হিফজ','তাজবীদ','তাফসীর'] },
    { name: 'ক্বারী রফিক', bio: 'সহীহ তিলাওয়াত ও তাজবীদ বিশেষজ্ঞ।', photo: 'https://i.pravatar.cc/240?u=i2', expertise: ['তাজবীদ','কিরাআত'] },
    { name: 'উস্তাদ ইউসুফ', bio: 'আরবি ভাষা ও সাহিত্যে বিশেষজ্ঞ — মদীনা ইউনিভার্সিটি গ্র্যাজুয়েট।', photo: 'https://i.pravatar.cc/240?u=i3', expertise: ['আরবি','সাহিত্য'] },
    { name: 'মুফতি ইব্রাহিম', bio: 'ফিকহ ও মাসায়েল বিভাগের প্রধান।', photo: 'https://i.pravatar.cc/240?u=i4', expertise: ['ফিকহ','মাসায়েল'] },
    { name: 'মাওলানা সাইফুল্লাহ', bio: 'হাদিস শাস্ত্রে বিশেষজ্ঞ।', photo: 'https://i.pravatar.cc/240?u=i5', expertise: ['হাদিস','উলুমুল হাদিস'] },
    { name: 'মাওলানা জুনায়েদ', bio: 'সিরাত ও ইসলামি ইতিহাসের শিক্ষক।', photo: 'https://i.pravatar.cc/240?u=i6', expertise: ['সিরাত','ইতিহাস'] },
    { name: 'উস্তাদা ফাতেমা', bio: 'পারিবারিক জীবন ও মহিলা শিক্ষার্থীদের কোর্স পরিচালনা করেন।', photo: 'https://i.pravatar.cc/240?u=i7', expertise: ['পরিবার','তরবিয়াত'] },
    { name: 'মুফতি জাকির', bio: 'তাফসীর ও কুরআন অধ্যয়নের বিশেষজ্ঞ।', photo: 'https://i.pravatar.cc/240?u=i8', expertise: ['তাফসীর','কুরআন'] }
      ]);
      console.log('🌱 Seeded instructors');
    }

    // Settings: whyJoin section + about + contact
    const whyExists = await Settings.findOne({ key: 'whyJoin' });
    if (!whyExists) {
      await Settings.create({ key: 'whyJoin', value: JSON.parse('{"title": "কেন ইবনে খালদুন ইনস্টিটিউটতে যুক্ত হবেন?", "subtitle": "অভিজ্ঞ আলেমদের তত্ত্বাবধানে অথেনটিক ইসলামি শিক্ষার সম্পূর্ণ অনলাইন প্ল্যাটফর্ম।", "items": [{"icon": "fa-user-graduate", "title": "অভিজ্ঞ আলেম", "desc": "দেশ-বিদেশের প্রসিদ্ধ আলেমদের কাছ থেকে সরাসরি শিক্ষা।"}, {"icon": "fa-laptop", "title": "যেকোনো ডিভাইস", "desc": "মোবাইল, ট্যাবলেট বা কম্পিউটার — যেকোনো স্থান থেকে।"}, {"icon": "fa-clock", "title": "সুবিধাজনক সময়", "desc": "নিজের সুবিধামতো সময়ে রেকর্ডেড ক্লাস দেখুন।"}, {"icon": "fa-certificate", "title": "সার্টিফিকেট", "desc": "কোর্স শেষে প্রতিষ্ঠান-স্বীকৃত সার্টিফিকেট।"}, {"icon": "fa-users", "title": "সাপোর্ট গ্রুপ", "desc": "প্রতিটি কোর্সের নিজস্ব WhatsApp সাপোর্ট।"}, {"icon": "fa-shield-halved", "title": "মানি-ব্যাক গ্যারান্টি", "desc": "৭ দিনের মধ্যে অসন্তুষ্ট হলে ১০০% রিফান্ড।"}]}') });
      console.log('🌱 Seeded whyJoin');
    }

    const aboutExists = await Settings.findOne({ key: 'about' });
    if (!aboutExists) {
      await Settings.create({ key: 'about', value: {
        title: 'ইবনে খালদুন ইনস্টিটিউট সম্পর্কে',
        body: '<p>ইবনে খালদুন ইনস্টিটিউট একটি অনলাইন ইসলামি শিক্ষা প্রতিষ্ঠান, যেখানে অভিজ্ঞ আলেমদের তত্ত্বাবধানে কুরআন, হাদিস, ফিকহ, আকীদা ও আরবি ভাষার অথেনটিক কোর্স পরিচালিত হয়।</p><p>আমাদের লক্ষ্য — ঘরে বসেই প্রতিটি মুসলিমের জন্য মানসম্পন্ন দীনি শিক্ষা পৌঁছে দেওয়া।</p>'
      } });
      console.log('🌱 Seeded about');
    }

    const contactExists = await Settings.findOne({ key: 'contact' });
    if (!contactExists) {
      await Settings.create({ key: 'contact', value: {
        email: 'ahmadyousuf276@gmail.com',
        phone: '+880 1XXX-XXXXXX',
        whatsapp: '+880 1XXX-XXXXXX',
        address: 'বাংলাদেশ',
        facebook: 'https://facebook.com/markazuddirasah',
        youtube: 'https://youtube.com/@markazuddirasah'
      } });
      console.log('🌱 Seeded contact');
    }

    console.log('✅ Seed check complete');
  } catch (err) {
    console.error('❌ Seed error:', err.message);
  }
}

// ============================================================
// 404
// ============================================================
app.use((req, res) => res.status(404).json({ error: 'Not found', path: req.path }));

app.listen(PORT, () => {
  console.log(`🚀 ${SITE_NAME} server on port ${PORT}`);
});
