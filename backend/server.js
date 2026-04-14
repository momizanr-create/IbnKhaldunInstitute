// ============================================================
// Ibn Khaldun Institute — Backend Server
// Node.js + Express + MongoDB + Cloudinary
// Deploy on: Render.com
// ============================================================

require('dotenv').config();

const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const multer   = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path   = require('path');
const jwt    = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

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
    // origin না থাকলে allow (Postman, Render internal call)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:4000',
      'http://localhost:5000',
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'http://127.0.0.1:3000',
      process.env.FRONTEND_URL,   // Vercel frontend URL
      process.env.ADMIN_URL,      // Vercel admin panel URL
    ].filter(Boolean);

    // যেকোনো vercel.app subdomain allow করা (সহজ সমাধান)
    if (origin.endsWith('.vercel.app') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Development এ file:// protocol থেকে আসা request allow
    if (origin.startsWith('file://')) {
      return callback(null, true);
    }

    console.warn('CORS blocked:', origin);
    callback(new Error('CORS: origin not allowed — ' + origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

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
  title:         String,
  slug:          { type: String, unique: true },
  category:      String,
  instructor:    String,
  price:         Number,
  originalPrice: Number,
  discount:      Number,
  description:   String,
  shortDesc:     String,
  thumbnail:     String,
  previewVideo:  String,
  duration:      String,
  lessons:       Number,
  students:      { type: Number, default: 0 },
  rating:        { type: Number, default: 4.5 },
  level:         { type: String, default: 'সকলের জন্য' },
  language:      { type: String, default: 'বাংলা' },
  tags:          [String],
  curriculum: [{
    sectionTitle: String,
    lessons: [{
      title: String, duration: String, videoId: String, isFree: Boolean,
    }],
  }],
  featured:  { type: Boolean, default: false },
  published: { type: Boolean, default: true },
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
  courseTitle:   String,
  amount:        Number,
  paymentMethod: String,
  transactionId: String,
  status:    { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now },
});
const Enrollment = mongoose.model('Enrollment', enrollmentSchema);

// ============================================================
// AUTH MIDDLEWARE
// ============================================================
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ============================================================
// ROUTES — HEALTH
// ============================================================
app.get('/', (req, res) =>
  res.json({ status: 'ok', message: 'Ibn Khaldun Institute API ✅', time: new Date().toISOString() })
);
app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', time: new Date().toISOString() })
);

// ============================================================
// ROUTES — AUTH
// ============================================================

// লগইন
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
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// প্রথমবার admin তৈরি (যদি কোনো admin না থাকে)
app.post('/api/admin/setup', async (req, res) => {
  try {
    const count = await Admin.countDocuments();
    if (count > 0) return res.status(400).json({ error: 'Admin already exists' });
    const hashed = await bcrypt.hash(req.body.password || 'admin123', 10);
    await Admin.create({ username: req.body.username || 'admin', password: hashed });
    res.json({ message: 'Admin created successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ⚠️ Admin Force Reset — জরুরি প্রয়োজনে ব্যবহার করুন
// ব্যবহারের পর RESET_SECRET পরিবর্তন করুন অথবা এই route সরিয়ে ফেলুন
app.post('/api/admin/force-reset', async (req, res) => {
  try {
    const { secret, username, password } = req.body;

    // Secret key দিয়ে protect করা — Render এ RESET_SECRET env variable দিন
    const RESET_SECRET = process.env.RESET_SECRET || 'ibn_reset_2024';
    if (secret !== RESET_SECRET) {
      return res.status(403).json({ error: 'Invalid secret key' });
    }

    const newUsername = username || 'admin';
    const newPassword = password || 'admin123';
    const hashed = await bcrypt.hash(newPassword, 10);

    await Admin.deleteMany({});
    await Admin.create({ username: newUsername, password: hashed });

    console.log(`✅ Admin force reset — username: "${newUsername}"`);
    res.json({ message: `Admin reset সফল। username: "${newUsername}"` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Password পরিবর্তন
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
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// ROUTES — COURSES
// ============================================================
app.get('/api/courses', async (req, res) => {
  try {
    const { category, featured, limit } = req.query;
    let query = { published: true };
    if (category) query.category = category;
    if (featured)  query.featured = true;
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
// ROUTES — INSTRUCTORS
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
// ROUTES — TESTIMONIALS
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
// ROUTES — NOTICES
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
// ROUTES — SETTINGS
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
// ROUTES — ENROLLMENTS
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
    let query = {};
    if (status) query.status = status;
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
// ROUTES — STATS
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
    res.json({
      courses, instructors, testimonials, enrollments,
      pendingEnrollments, revenue: totalRevenue[0]?.total || 0,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Upload image ──
app.post('/api/admin/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ url: req.file.path, public_id: req.file.filename });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// AUTO-CREATE ADMIN (first run)
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
      console.log('ℹ️  Admin ইতিমধ্যে বিদ্যমান, count:', count);
    }
  } catch (err) {
    console.error('❌ Admin তৈরিতে সমস্যা:', err.message);
  }
}

// ============================================================
// START SERVER
// ============================================================
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ MongoDB connected');
    await ensureAdminExists();
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch(err => console.error('❌ MongoDB error:', err));