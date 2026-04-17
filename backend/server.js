// ============================================================
// Ibn Khaldun Institute — Backend Server
// Node.js + Express + MongoDB + Cloudinary
// Deploy on: Render.com  →  https://ibnkhalduninstitute.onrender.com
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

const app        = express();
const PORT       = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'ibn_khaldun_secret_2024';

// ── Cloudinary Config ──
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ============================================================
// CORS — সব Vercel URL + localhost allow
// ============================================================
app.use(cors({
  origin: (origin, callback) => {
    // Origin না থাকলে allow (Postman / server-to-server)
    if (!origin) return callback(null, true);

    // যেকোনো vercel.app বা onrender.com subdomain allow
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    if (origin.endsWith('.onrender.com')) return callback(null, true);

    // localhost / 127.0.0.1 যেকোনো port allow
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }

    // নির্দিষ্ট allowed origins
    const allowed = [
      'https://ibn-khaldun-institute-ucpf.vercel.app',
      'https://ibn-khaldun-institute-tt9e.vercel.app',
      'https://ibnkhalduninstitute.onrender.com',
      process.env.FRONTEND_URL,
      process.env.ADMIN_URL,
      process.env.RENDER_URL,
    ].filter(Boolean);

    if (allowed.includes(origin)) return callback(null, true);

    console.warn('⚠️ CORS blocked:', origin);
    callback(new Error('CORS: not allowed — ' + origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Preflight OPTIONS সব route এ handle
app.options('*', cors());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Cloudinary Multer Storage ──
const imageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'ibn-khaldun',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'],
  },
});
const upload = multer({ storage: imageStorage });

// ============================================================
// SCHEMAS
// ============================================================
const adminSchema = new mongoose.Schema({
  username:  { type: String, unique: true },
  password:  String,
  createdAt: { type: Date, default: Date.now },
});
const Admin = mongoose.model('Admin', adminSchema);

const courseSchema = new mongoose.Schema({
  title: String, slug: { type: String, unique: true },
  category: String, subCategory: String, instructor: String,
  price: Number, originalPrice: Number, discount: Number,
  description: String, shortDesc: String,
  thumbnail: String, previewVideo: String,
  duration: String, lessons: Number,
  students:  { type: Number, default: 0 },
  rating:    { type: Number, default: 4.5 },
  level:     { type: String, default: 'সকলের জন্য' },
  language:  { type: String, default: 'বাংলা' },
  tags: [String],
  curriculum: [{
    sectionTitle: String,
    lessons: [{ title: String, duration: String, videoId: String, isFree: Boolean }],
  }],
  featured:  { type: Boolean, default: false },
  published: { type: Boolean, default: true },
  tabKey:    { type: String, default: '' },   // কোন ট্যাবে দেখাবে
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
const Course = mongoose.model('Course', courseSchema);

const instructorSchema = new mongoose.Schema({
  name: String, slug: String, title: String, bio: String, photo: String,
  specializations: [String],
  students: { type: Number, default: 0 },
  courses:  { type: Number, default: 0 },
  rating:   { type: Number, default: 4.8 },
  social: { facebook: String, twitter: String, linkedin: String, youtube: String },
  published: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});
const Instructor = mongoose.model('Instructor', instructorSchema);

const testimonialSchema = new mongoose.Schema({
  name: String, role: String, text: String,
  rating:    { type: Number, default: 5 },
  avatar:    String,
  published: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});
const Testimonial = mongoose.model('Testimonial', testimonialSchema);

const noticeSchema = new mongoose.Schema({
  title: String, body: String, imageUrl: String, ctaText: String, ctaLink: String,
  active:    { type: Boolean, default: true },
  startDate: Date, endDate: Date,
  createdAt: { type: Date, default: Date.now },
});
const Notice = mongoose.model('Notice', noticeSchema);

const settingsSchema = new mongoose.Schema({
  key:       { type: String, unique: true },
  value:     mongoose.Schema.Types.Mixed,
  updatedAt: { type: Date, default: Date.now },
});
const Settings = mongoose.model('Settings', settingsSchema);

const enrollmentSchema = new mongoose.Schema({
  studentName: String, studentEmail: String, studentPhone: String,
  courseId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  courseTitle:   String, amount: Number,
  paymentMethod: String, transactionId: String,
  status:    { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now },
});
const Enrollment = mongoose.model('Enrollment', enrollmentSchema);

// ── User Schema (for student accounts) ──
const userSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  email:     { type: String, unique: true, required: true, lowercase: true },
  password:  { type: String, required: true },
  avatar:    { type: String, default: '' },
  enrolledCourses: [{
    courseId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    courseSlug: String,
    courseTitle: String,
    thumbnail:  String,
    enrolledAt: { type: Date, default: Date.now },
    progress:   { type: Number, default: 0 }, // 0-100 percent
    completedLessons: [String], // lesson videoIds
    certificateIssued: { type: Boolean, default: false },
  }],
  createdAt: { type: Date, default: Date.now },
});
const User = mongoose.model('User', userSchema);

// ── Category Schema ──
const subCategorySchema = new mongoose.Schema({
  name:   { type: String, required: true },
  slug:   { type: String, required: true },
  icon:   { type: String, default: '' },
  order:  { type: Number, default: 0 },
  active: { type: Boolean, default: true },
});
const categorySchema = new mongoose.Schema({
  name:         { type: String, required: true },
  slug:         { type: String, unique: true },
  icon:         { type: String, default: '📚' },
  order:        { type: Number, default: 0 },
  active:       { type: Boolean, default: true },
  subCategories:[ subCategorySchema ],
  createdAt:    { type: Date, default: Date.now },
});
const Category = mongoose.model('Category', categorySchema);

// ── Course Tab Schema ──
const courseTabSchema = new mongoose.Schema({
  label:  { type: String, required: true },
  key:    { type: String, required: true, unique: true },
  icon:   { type: String, default: '' },
  order:  { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});
const CourseTab = mongoose.model('CourseTab', courseTabSchema);

// ── Course Access Request Schema ──
const accessRequestSchema = new mongoose.Schema({
  userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName:        String,
  userEmail:       String,
  userPhone:       String,          // ফোন নম্বর
  transactionId:   String,          // ট্রানজেকশন আইডি
  paymentMethod:   String,          // bKash, Nagad, Rocket, Card
  courseId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  courseTitle:     String,
  courseSlug:      String,
  thumbnail:       String,
  price:           Number,
  status:          { type: String, default: 'pending' }, // pending, approved, rejected
  message:         String,
  createdAt:       { type: Date, default: Date.now },
  processedAt:     Date,
});
const AccessRequest = mongoose.model('AccessRequest', accessRequestSchema);

// ============================================================
// AUTH MIDDLEWARE
// ============================================================
function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ============================================================
// STATIC FILES — index.html ও admin.html serve করার জন্য
// ============================================================
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// HEALTH
// ============================================================
app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', time: new Date().toISOString() })
);

// ── HTML Routes ──
app.get('/', (req, res) => {
  const htmlFile = path.join(__dirname, 'public', 'index.html');
  const fs = require('fs');
  if (fs.existsSync(htmlFile)) {
    res.sendFile(htmlFile);
  } else {
    res.json({ status: 'ok', message: 'Ibn Khaldun Institute API ✅', time: new Date().toISOString() });
  }
});
app.get('/admin', (req, res) => {
  const htmlFile = path.join(__dirname, 'public', 'admin.html');
  const fs = require('fs');
  if (fs.existsSync(htmlFile)) {
    res.sendFile(htmlFile);
  } else {
    res.status(404).json({ error: 'admin.html not found in public/' });
  }
});
app.get('/admin.html', (req, res) => {
  res.redirect('/admin');
});

// ============================================================
// AUTH ROUTES
// ============================================================
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'username এবং password দিন' });
    const admin = await Admin.findOne({ username: username.trim() });
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, admin.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: admin._id, username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// প্রথমবার setup (admin না থাকলে)
app.post('/api/admin/setup', async (req, res) => {
  try {
    const count = await Admin.countDocuments();
    if (count > 0) return res.status(400).json({ error: 'Admin already exists' });
    const hashed = await bcrypt.hash(req.body.password || 'admin123', 10);
    await Admin.create({ username: req.body.username || 'admin', password: hashed });
    res.json({ message: 'Admin created successfully' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Force reset — secret দিয়ে protect করা
app.post('/api/admin/force-reset', async (req, res) => {
  try {
    const { secret, username, password } = req.body;
    const RESET_SECRET = process.env.RESET_SECRET || 'ibn_reset_2024';
    if (secret !== RESET_SECRET)
      return res.status(403).json({ error: 'Invalid secret key' });
    const hashed = await bcrypt.hash(password || 'admin123', 10);
    await Admin.deleteMany({});
    await Admin.create({ username: username || 'admin', password: hashed });
    console.log('✅ Admin force reset done');
    res.json({ message: 'Admin reset সফল হয়েছে' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Password change
app.post('/api/admin/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const admin = await Admin.findById(req.admin.id);
    if (!admin) return res.status(404).json({ error: 'Admin not found' });
    const ok = await bcrypt.compare(currentPassword, admin.password);
    if (!ok) return res.status(401).json({ error: 'Current password incorrect' });
    admin.password = await bcrypt.hash(newPassword, 10);
    await admin.save();
    res.json({ message: 'Password changed successfully' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// COURSES
// ============================================================
app.get('/api/courses', async (req, res) => {
  try {
    const { category, featured, limit } = req.query;
    let query = { published: true };
    if (category) query.category = category;
    if (featured) query.featured = true;
    let q = Course.find(query).sort({ createdAt: -1 });
    if (limit) q = q.limit(parseInt(limit));
    res.json(await q);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/courses/:slug', async (req, res) => {
  try {
    const course = await Course.findOne({ slug: req.params.slug });
    if (!course) return res.status(404).json({ error: 'Not found' });
    res.json(course);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/courses', authMiddleware, async (req, res) => {
  try { res.json(await Course.find().sort({ createdAt: -1 })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/courses', authMiddleware, upload.single('thumbnail'), async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) data.thumbnail = req.file.path;
    if (data.tags && typeof data.tags === 'string')
      data.tags = data.tags.split(',').map(t => t.trim());
    if (data.curriculum && typeof data.curriculum === 'string')
      data.curriculum = JSON.parse(data.curriculum);
    if (!data.slug)
      data.slug = data.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    const course = new Course(data);
    await course.save();
    res.json(course);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/admin/courses/:id', authMiddleware, upload.single('thumbnail'), async (req, res) => {
  try {
    const data = { ...req.body, updatedAt: new Date() };
    if (req.file) data.thumbnail = req.file.path;
    if (data.tags && typeof data.tags === 'string')
      data.tags = data.tags.split(',').map(t => t.trim());
    if (data.curriculum && typeof data.curriculum === 'string')
      data.curriculum = JSON.parse(data.curriculum);
    const course = await Course.findByIdAndUpdate(req.params.id, data, { new: true });
    res.json(course);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/admin/courses/:id', authMiddleware, async (req, res) => {
  try { await Course.findByIdAndDelete(req.params.id); res.json({ message: 'Deleted' }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// INSTRUCTORS
// ============================================================
app.get('/api/instructors', async (req, res) => {
  try { res.json(await Instructor.find({ published: true }).sort({ createdAt: -1 })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/instructors', authMiddleware, async (req, res) => {
  try { res.json(await Instructor.find().sort({ createdAt: -1 })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/instructors', authMiddleware, upload.single('photo'), async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) data.photo = req.file.path;
    if (data.specializations && typeof data.specializations === 'string')
      data.specializations = data.specializations.split(',').map(s => s.trim());
    if (!data.slug) data.slug = data.name.toLowerCase().replace(/\s+/g, '-');
    const inst = new Instructor(data);
    await inst.save();
    res.json(inst);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/admin/instructors/:id', authMiddleware, upload.single('photo'), async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) data.photo = req.file.path;
    if (data.specializations && typeof data.specializations === 'string')
      data.specializations = data.specializations.split(',').map(s => s.trim());
    const inst = await Instructor.findByIdAndUpdate(req.params.id, data, { new: true });
    res.json(inst);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/admin/instructors/:id', authMiddleware, async (req, res) => {
  try { await Instructor.findByIdAndDelete(req.params.id); res.json({ message: 'Deleted' }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// TESTIMONIALS
// ============================================================
app.get('/api/testimonials', async (req, res) => {
  try { res.json(await Testimonial.find({ published: true }).sort({ createdAt: -1 })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/testimonials', authMiddleware, async (req, res) => {
  try { res.json(await Testimonial.find().sort({ createdAt: -1 })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/testimonials', authMiddleware, upload.single('avatar'), async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) data.avatar = req.file.path;
    const t = new Testimonial(data);
    await t.save();
    res.json(t);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/admin/testimonials/:id', authMiddleware, upload.single('avatar'), async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) data.avatar = req.file.path;
    const t = await Testimonial.findByIdAndUpdate(req.params.id, data, { new: true });
    res.json(t);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/admin/testimonials/:id', authMiddleware, async (req, res) => {
  try { await Testimonial.findByIdAndDelete(req.params.id); res.json({ message: 'Deleted' }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// NOTICES
// ============================================================
app.get('/api/notices', async (req, res) => {
  try { res.json(await Notice.find({ active: true })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/notices', authMiddleware, async (req, res) => {
  try { res.json(await Notice.find().sort({ createdAt: -1 })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/notices', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) data.imageUrl = req.file.path;
    const n = new Notice(data);
    await n.save();
    res.json(n);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/admin/notices/:id', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) data.imageUrl = req.file.path;
    const n = await Notice.findByIdAndUpdate(req.params.id, data, { new: true });
    res.json(n);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/admin/notices/:id', authMiddleware, async (req, res) => {
  try { await Notice.findByIdAndDelete(req.params.id); res.json({ message: 'Deleted' }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// SETTINGS
// ============================================================
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await Settings.find();
    const obj = {};
    settings.forEach(s => { obj[s.key] = s.value; });
    res.json(obj);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/settings', authMiddleware, async (req, res) => {
  try {
    for (const [key, value] of Object.entries(req.body)) {
      await Settings.findOneAndUpdate({ key }, { key, value, updatedAt: new Date() }, { upsert: true });
    }
    res.json({ message: 'Settings saved' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/settings/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    res.json({ url: req.file.path });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// ENROLLMENTS
// ============================================================
app.post('/api/enrollments', async (req, res) => {
  try {
    const e = new Enrollment(req.body);
    await e.save();
    res.json({ message: 'Enrollment submitted', id: e._id });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/admin/enrollments', authMiddleware, async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};
    res.json(await Enrollment.find(query).sort({ createdAt: -1 }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/admin/enrollments/:id', authMiddleware, async (req, res) => {
  try {
    const e = await Enrollment.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(e);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/admin/enrollments/:id', authMiddleware, async (req, res) => {
  try { await Enrollment.findByIdAndDelete(req.params.id); res.json({ message: 'Deleted' }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// COURSE DETAIL (curriculum per course stored in Settings)
// ============================================================
app.get('/api/admin/course-detail/:id', authMiddleware, async (req, res) => {
  try {
    const s = await Settings.findOne({ key: 'course_detail_' + req.params.id });
    res.json(s ? s.value : {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/admin/course-detail/:id', authMiddleware, async (req, res) => {
  try {
    const key = 'course_detail_' + req.params.id;
    await Settings.findOneAndUpdate(
      { key },
      { key, value: req.body, updatedAt: new Date() },
      { upsert: true }
    );
    // Also update curriculum + price in the Course document
    await Course.findByIdAndUpdate(req.params.id, {
      description: req.body.description,
      price: req.body.price,
      originalPrice: req.body.oldPrice,
      previewVideo: req.body.youtubeId,
      curriculum: (req.body.curriculum || []).map(sec => ({
        sectionTitle: sec.title,
        lessons: (sec.lessons || []).map(ls => ({
          title: ls.title,
          duration: ls.duration,
          videoId: ls.youtubeId,
          isFree: ls.free || false,
        })),
      })),
      updatedAt: new Date(),
    });
    res.json({ message: 'Saved' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Public course detail (for index.html)
app.get('/api/course-detail/:id', async (req, res) => {
  try {
    const s = await Settings.findOne({ key: 'course_detail_' + req.params.id });
    res.json(s ? s.value : {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// SITE SETTINGS
// ============================================================
app.get('/api/site-settings', async (req, res) => {
  try {
    const s = await Settings.findOne({ key: 'site_settings' });
    res.json(s ? s.value : {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/admin/site-settings', authMiddleware, async (req, res) => {
  try {
    const s = await Settings.findOne({ key: 'site_settings' });
    res.json(s ? s.value : {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/admin/site-settings', authMiddleware, async (req, res) => {
  try {
    await Settings.findOneAndUpdate(
      { key: 'site_settings' },
      { key: 'site_settings', value: req.body, updatedAt: new Date() },
      { upsert: true }
    );
    res.json({ message: 'Saved' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// HERO SECTION
// ============================================================
app.get('/api/hero-section', async (req, res) => {
  try {
    const s = await Settings.findOne({ key: 'hero_section' });
    res.json(s ? s.value : {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/admin/hero-section', authMiddleware, async (req, res) => {
  try {
    const s = await Settings.findOne({ key: 'hero_section' });
    res.json(s ? s.value : {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/admin/hero-section', authMiddleware, async (req, res) => {
  try {
    await Settings.findOneAndUpdate(
      { key: 'hero_section' },
      { key: 'hero_section', value: req.body, updatedAt: new Date() },
      { upsert: true }
    );
    res.json({ message: 'Saved' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// NAVIGATION
// ============================================================
app.get('/api/navigation', async (req, res) => {
  try {
    const s = await Settings.findOne({ key: 'navigation' });
    res.json(s ? s.value : {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/admin/navigation', authMiddleware, async (req, res) => {
  try {
    const s = await Settings.findOne({ key: 'navigation' });
    res.json(s ? s.value : {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/admin/navigation', authMiddleware, async (req, res) => {
  try {
    await Settings.findOneAndUpdate(
      { key: 'navigation' },
      { key: 'navigation', value: req.body, updatedAt: new Date() },
      { upsert: true }
    );
    res.json({ message: 'Saved' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// FOOTER
// ============================================================
app.get('/api/footer', async (req, res) => {
  try {
    const s = await Settings.findOne({ key: 'footer' });
    res.json(s ? s.value : {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/admin/footer', authMiddleware, async (req, res) => {
  try {
    const s = await Settings.findOne({ key: 'footer' });
    res.json(s ? s.value : {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/admin/footer', authMiddleware, async (req, res) => {
  try {
    await Settings.findOneAndUpdate(
      { key: 'footer' },
      { key: 'footer', value: req.body, updatedAt: new Date() },
      { upsert: true }
    );
    res.json({ message: 'Saved' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// THEME SETTINGS
// ============================================================
app.get('/api/theme-settings', async (req, res) => {
  try {
    const s = await Settings.findOne({ key: 'theme_settings' });
    res.json(s ? s.value : {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/admin/theme-settings', authMiddleware, async (req, res) => {
  try {
    const s = await Settings.findOne({ key: 'theme_settings' });
    res.json(s ? s.value : {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/admin/theme-settings', authMiddleware, async (req, res) => {
  try {
    await Settings.findOneAndUpdate(
      { key: 'theme_settings' },
      { key: 'theme_settings', value: req.body, updatedAt: new Date() },
      { upsert: true }
    );
    res.json({ message: 'Saved' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// WELCOME POPUP
// ============================================================
app.get('/api/welcome-popup', async (req, res) => {
  try {
    const s = await Settings.findOne({ key: 'welcome_popup' });
    res.json(s ? s.value : {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/admin/welcome-popup', authMiddleware, async (req, res) => {
  try {
    const s = await Settings.findOne({ key: 'welcome_popup' });
    res.json(s ? s.value : {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/admin/welcome-popup', authMiddleware, async (req, res) => {
  try {
    await Settings.findOneAndUpdate(
      { key: 'welcome_popup' },
      { key: 'welcome_popup', value: req.body, updatedAt: new Date() },
      { upsert: true }
    );
    res.json({ message: 'Saved' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// CTA SECTION
// ============================================================
app.get('/api/cta-section', async (req, res) => {
  try {
    const s = await Settings.findOne({ key: 'cta_section' });
    res.json(s ? s.value : {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/admin/cta-section', authMiddleware, async (req, res) => {
  try {
    const s = await Settings.findOne({ key: 'cta_section' });
    res.json(s ? s.value : {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/admin/cta-section', authMiddleware, async (req, res) => {
  try {
    await Settings.findOneAndUpdate(
      { key: 'cta_section' },
      { key: 'cta_section', value: req.body, updatedAt: new Date() },
      { upsert: true }
    );
    res.json({ message: 'Saved' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// FEATURED COURSES CONFIG
// ============================================================
app.get('/api/featured-courses-config', async (req, res) => {
  try {
    const s = await Settings.findOne({ key: 'featured_courses_config' });
    res.json(s ? s.value : {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/admin/featured-courses-config', authMiddleware, async (req, res) => {
  try {
    const s = await Settings.findOne({ key: 'featured_courses_config' });
    res.json(s ? s.value : {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/admin/featured-courses-config', authMiddleware, async (req, res) => {
  try {
    await Settings.findOneAndUpdate(
      { key: 'featured_courses_config' },
      { key: 'featured_courses_config', value: req.body, updatedAt: new Date() },
      { upsert: true }
    );
    res.json({ message: 'Saved' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// STATS
// ============================================================
app.get('/api/admin/stats', authMiddleware, async (req, res) => {
  try {
    const [courses, instructors, testimonials, enrollments] = await Promise.all([
      Course.countDocuments(), Instructor.countDocuments(),
      Testimonial.countDocuments(), Enrollment.countDocuments(),
    ]);
    const pendingEnrollments = await Enrollment.countDocuments({ status: 'pending' });
    const totalRevenue = await Enrollment.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    res.json({ courses, instructors, testimonials, enrollments,
      pendingEnrollments, revenue: totalRevenue[0]?.total || 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ url: req.file.path, public_id: req.file.filename });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// USER AUTH (Student Accounts)
// ============================================================
app.post('/api/user/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'নাম, ইমেইল ও পাসওয়ার্ড দিন' });
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(400).json({ error: 'এই ইমেইল দিয়ে আগেই অ্যাকাউন্ট আছে' });
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email: email.toLowerCase(), password: hashed });
    const token = jwt.sign({ id: user._id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, enrolledCourses: [] } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/user/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'ইমেইল ও পাসওয়ার্ড দিন' });
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: 'ইমেইল বা পাসওয়ার্ড ভুল' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'ইমেইল বা পাসওয়ার্ড ভুল' });
    const token = jwt.sign({ id: user._id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, enrolledCourses: user.enrolledCourses } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// User middleware
function userAuthMiddleware(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'লগইন করুন' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'সেশন শেষ, আবার লগইন করুন' });
  }
}

app.get('/api/user/me', userAuthMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Update lesson progress
app.post('/api/user/progress', userAuthMiddleware, async (req, res) => {
  try {
    const { courseId, lessonId } = req.body;
    const user = await User.findById(req.user.id);
    const enrollment = user.enrolledCourses.find(e => e.courseId.toString() === courseId);
    if (!enrollment) return res.status(403).json({ error: 'এই কোর্সে এনরোল নেই' });
    if (!enrollment.completedLessons.includes(lessonId)) {
      enrollment.completedLessons.push(lessonId);
    }
    // Get total lessons for this course
    const course = await Course.findById(courseId);
    let totalLessons = 0;
    if (course?.curriculum) {
      course.curriculum.forEach(sec => { totalLessons += (sec.lessons || []).length; });
    }
    if (totalLessons > 0) {
      enrollment.progress = Math.round((enrollment.completedLessons.length / totalLessons) * 100);
    }
    if (enrollment.progress >= 100) {
      enrollment.certificateIssued = true;
    }
    await user.save();
    res.json({ progress: enrollment.progress, certificate: enrollment.certificateIssued });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// CATEGORIES (with sub-categories)
// ============================================================
app.get('/api/categories', async (req, res) => {
  try { res.json(await Category.find({ active: true }).sort({ order: 1, createdAt: 1 })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/admin/categories', authMiddleware, async (req, res) => {
  try { res.json(await Category.find().sort({ order: 1, createdAt: 1 })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/admin/categories', authMiddleware, async (req, res) => {
  try {
    const { name, icon, order, subCategories } = req.body;
    if (!name) return res.status(400).json({ error: 'নাম দিন' });
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    const cat = await Category.create({
      name, slug, icon: icon || '📚', order: order || 0,
      subCategories: (subCategories || []).map(s => ({
        name: s.name, icon: s.icon || '',
        slug: s.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, ''),
        order: s.order || 0, active: s.active !== false,
      })),
    });
    res.json(cat);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.put('/api/admin/categories/:id', authMiddleware, async (req, res) => {
  try {
    const update = { ...req.body };
    if (update.subCategories) {
      update.subCategories = update.subCategories.map(s => ({
        ...s,
        slug: s.slug || s.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, ''),
      }));
    }
    const cat = await Category.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json(cat);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.delete('/api/admin/categories/:id', authMiddleware, async (req, res) => {
  try { await Category.findByIdAndDelete(req.params.id); res.json({ message: 'Deleted' }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Subcategory CRUD helpers
app.post('/api/admin/categories/:id/subcategories', authMiddleware, async (req, res) => {
  try {
    const cat = await Category.findById(req.params.id);
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    const { name, icon, order } = req.body;
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    cat.subCategories.push({ name, slug, icon: icon || '', order: order || 0, active: true });
    await cat.save();
    res.json(cat);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.put('/api/admin/categories/:id/subcategories/:subId', authMiddleware, async (req, res) => {
  try {
    const cat = await Category.findById(req.params.id);
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    const sub = cat.subCategories.id(req.params.subId);
    if (!sub) return res.status(404).json({ error: 'SubCategory not found' });
    Object.assign(sub, req.body);
    await cat.save();
    res.json(cat);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.delete('/api/admin/categories/:id/subcategories/:subId', authMiddleware, async (req, res) => {
  try {
    const cat = await Category.findById(req.params.id);
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    cat.subCategories.pull(req.params.subId);
    await cat.save();
    res.json(cat);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ============================================================
// COURSE TABS
// ============================================================
app.get('/api/course-tabs', async (req, res) => {
  try { res.json(await CourseTab.find({ active: true }).sort({ order: 1 })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/admin/course-tabs', authMiddleware, async (req, res) => {
  try { res.json(await CourseTab.find().sort({ order: 1 })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/admin/course-tabs', authMiddleware, async (req, res) => {
  try {
    const tab = await CourseTab.create(req.body);
    res.json(tab);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.put('/api/admin/course-tabs/:id', authMiddleware, async (req, res) => {
  try {
    const tab = await CourseTab.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(tab);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.delete('/api/admin/course-tabs/:id', authMiddleware, async (req, res) => {
  try { await CourseTab.findByIdAndDelete(req.params.id); res.json({ message: 'Deleted' }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// COURSE ACCESS REQUESTS
// ============================================================
app.post('/api/access-request', userAuthMiddleware, async (req, res) => {
  try {
    const { courseId, courseTitle, courseSlug, thumbnail, price,
            userPhone, transactionId, paymentMethod } = req.body;
    // Check if already enrolled
    const user = await User.findById(req.user.id);
    const alreadyEnrolled = user.enrolledCourses.some(e => e.courseId.toString() === courseId);
    if (alreadyEnrolled) return res.status(400).json({ error: 'আপনি ইতিমধ্যে এই কোর্সে এনরোল আছেন' });
    // Check if pending request already exists
    const existing = await AccessRequest.findOne({ userId: req.user.id, courseId, status: 'pending' });
    if (existing) return res.status(400).json({ error: 'আপনার অনুরোধ ইতিমধ্যে পাঠানো হয়েছে, অনুমোদনের অপেক্ষায় আছে' });
    const req2 = await AccessRequest.create({
      userId:        req.user.id,
      userName:      req.user.name,
      userEmail:     req.user.email,
      userPhone:     userPhone || '',
      transactionId: transactionId || '',
      paymentMethod: paymentMethod || '',
      courseId, courseTitle, courseSlug, thumbnail,
      price: price || 0,
    });
    res.json({ message: 'অ্যাক্সেস অনুরোধ পাঠানো হয়েছে', requestId: req2._id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/access-requests', authMiddleware, async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};
    res.json(await AccessRequest.find(query).sort({ createdAt: -1 }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Admin approves / rejects access request
app.put('/api/admin/access-requests/:id', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body; // 'approved' or 'rejected'
    const request = await AccessRequest.findByIdAndUpdate(
      req.params.id,
      { status, processedAt: new Date() },
      { new: true }
    );
    if (!request) return res.status(404).json({ error: 'Request not found' });

    if (status === 'approved') {
      // Add course to user's enrolled courses
      await User.findByIdAndUpdate(request.userId, {
        $push: {
          enrolledCourses: {
            courseId: request.courseId,
            courseSlug: request.courseSlug,
            courseTitle: request.courseTitle,
            thumbnail: request.thumbnail,
            enrolledAt: new Date(),
            progress: 0,
          }
        }
      });
    }
    res.json({ message: status === 'approved' ? '✅ অ্যাক্সেস দেওয়া হয়েছে' : '❌ অনুরোধ প্রত্যাখ্যান করা হয়েছে', request });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// User checks their own access request status for a course
app.get('/api/access-request/status/:courseId', userAuthMiddleware, async (req, res) => {
  try {
    const req2 = await AccessRequest.findOne({ userId: req.user.id, courseId: req.params.courseId });
    res.json(req2 ? { status: req2.status } : { status: 'none' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Admin — list all users
app.get('/api/admin/users', authMiddleware, async (req, res) => {
  try { res.json(await User.find().select('-password').sort({ createdAt: -1 })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// AUTO-CREATE ADMIN
// ============================================================
async function ensureAdminExists() {
  try {
    const count = await Admin.countDocuments();
    if (count === 0) {
      const username = process.env.ADMIN_USERNAME || 'admin';
      const password = process.env.ADMIN_PASSWORD || 'admin123';
      const hashed   = await bcrypt.hash(password, 10);
      await Admin.create({ username, password: hashed });
      console.log(`✅ Admin তৈরি হয়েছে — username: "${username}"`);
    } else {
      console.log(`ℹ️  Admin আছে (count: ${count})`);
    }
  } catch (err) {
    console.error('❌ Admin তৈরিতে সমস্যা:', err.message);
  }
}

// ============================================================
// START
// ============================================================
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ MongoDB connected');
    await ensureAdminExists();
    app.listen(PORT, () => console.log(`🚀 Server: http://localhost:${PORT}`));
  })
  .catch(err => console.error('❌ MongoDB error:', err));