// ============================================================
// Ibn Khaldun Institute — Backend Server
// Node.js + Express + MongoDB + Cloudinary
// ============================================================

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'ibn_khaldun_secret_2024';

// ── Cloudinary Config ──
cloudinary.config({
  cloud_name: 'dtwodm2tk',
  api_key: '645534351656872',
  api_secret: 'GlD8B8hwIBaZGm2sEUWxoefW5Kg',
});

// ── MongoDB ──
mongoose.connect('mongodb+srv://momizanr_db_user:sPW6ojToMJB8GPrY@cluster0.crr3jw6.mongodb.net/IbnKhaldunInstitute?appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// ── Middleware ──
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Serve static files ──
app.use('/frontend', express.static(path.join(__dirname, '../frontend')));
app.use('/admin', express.static(path.join(__dirname, '../admin_panel')));

// ── Cloudinary Multer Storage ──
const imageStorage = new CloudinaryStorage({
  cloudinary,
  params: { folder: 'ibn-khaldun', allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'] },
});
const upload = multer({ storage: imageStorage });
const memUpload = multer({ storage: multer.memoryStorage() });

// ============================================================
// SCHEMAS
// ============================================================

// Admin
const adminSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
  email: String,
  createdAt: { type: Date, default: Date.now },
});
const Admin = mongoose.model('Admin', adminSchema);

// Course
const courseSchema = new mongoose.Schema({
  title: String,
  slug: { type: String, unique: true },
  category: String,
  instructor: String,
  price: Number,
  originalPrice: Number,
  discount: Number,
  description: String,
  shortDesc: String,
  thumbnail: String,       // Cloudinary URL
  previewVideo: String,    // YouTube ID or URL
  duration: String,
  lessons: Number,
  students: { type: Number, default: 0 },
  rating: { type: Number, default: 4.5 },
  level: { type: String, default: 'সকলের জন্য' },
  language: { type: String, default: 'বাংলা' },
  tags: [String],
  curriculum: [{
    sectionTitle: String,
    lessons: [{
      title: String,
      duration: String,
      videoId: String,
      isFree: Boolean,
    }]
  }],
  featured: { type: Boolean, default: false },
  published: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
const Course = mongoose.model('Course', courseSchema);

// Instructor
const instructorSchema = new mongoose.Schema({
  name: String,
  slug: String,
  title: String,
  bio: String,
  photo: String,
  specializations: [String],
  students: { type: Number, default: 0 },
  courses: { type: Number, default: 0 },
  rating: { type: Number, default: 4.8 },
  social: {
    facebook: String,
    twitter: String,
    linkedin: String,
    youtube: String,
  },
  published: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});
const Instructor = mongoose.model('Instructor', instructorSchema);

// Testimonial
const testimonialSchema = new mongoose.Schema({
  name: String,
  role: String,
  text: String,
  rating: { type: Number, default: 5 },
  avatar: String,
  published: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});
const Testimonial = mongoose.model('Testimonial', testimonialSchema);

// Notice / Popup
const noticeSchema = new mongoose.Schema({
  title: String,
  body: String,
  imageUrl: String,
  ctaText: String,
  ctaLink: String,
  active: { type: Boolean, default: true },
  startDate: Date,
  endDate: Date,
  createdAt: { type: Date, default: Date.now },
});
const Notice = mongoose.model('Notice', noticeSchema);

// Site Settings
const settingsSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  value: mongoose.Schema.Types.Mixed,
  updatedAt: { type: Date, default: Date.now },
});
const Settings = mongoose.model('Settings', settingsSchema);

// Enrollment
const enrollmentSchema = new mongoose.Schema({
  studentName: String,
  studentEmail: String,
  studentPhone: String,
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  courseTitle: String,
  amount: Number,
  paymentMethod: String,
  transactionId: String,
  status: { type: String, default: 'pending' }, // pending, approved, rejected
  createdAt: { type: Date, default: Date.now },
});
const Enrollment = mongoose.model('Enrollment', enrollmentSchema);

// ============================================================
// AUTH MIDDLEWARE
// ============================================================
function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ============================================================
// ROUTES — AUTH
// ============================================================
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  const admin = await Admin.findOne({ username });
  if (!admin) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, admin.password);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: admin._id, username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, username });
});

app.post('/api/admin/setup', async (req, res) => {
  const count = await Admin.countDocuments();
  if (count > 0) return res.status(400).json({ error: 'Admin already exists' });
  const hashed = await bcrypt.hash(req.body.password || 'admin123', 10);
  const admin = new Admin({ username: req.body.username || 'admin', password: hashed, email: req.body.email || '' });
  await admin.save();
  res.json({ message: 'Admin created' });
});

// ============================================================
// ROUTES — COURSES (Public)
// ============================================================
app.get('/api/courses', async (req, res) => {
  const { category, featured, limit } = req.query;
  let query = { published: true };
  if (category) query.category = category;
  if (featured) query.featured = true;
  let q = Course.find(query).sort({ createdAt: -1 });
  if (limit) q = q.limit(parseInt(limit));
  res.json(await q);
});

app.get('/api/courses/:slug', async (req, res) => {
  const course = await Course.findOne({ slug: req.params.slug });
  if (!course) return res.status(404).json({ error: 'Not found' });
  res.json(course);
});

// ============================================================
// ROUTES — COURSES (Admin)
// ============================================================
app.get('/api/admin/courses', authMiddleware, async (req, res) => {
  res.json(await Course.find().sort({ createdAt: -1 }));
});

app.post('/api/admin/courses', authMiddleware, upload.single('thumbnail'), async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) data.thumbnail = req.file.path;
    if (data.tags && typeof data.tags === 'string') data.tags = data.tags.split(',').map(t => t.trim());
    if (data.curriculum && typeof data.curriculum === 'string') data.curriculum = JSON.parse(data.curriculum);
    data.slug = data.slug || data.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    const course = new Course(data);
    await course.save();
    res.json(course);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/admin/courses/:id', authMiddleware, upload.single('thumbnail'), async (req, res) => {
  try {
    const data = { ...req.body, updatedAt: new Date() };
    if (req.file) data.thumbnail = req.file.path;
    if (data.tags && typeof data.tags === 'string') data.tags = data.tags.split(',').map(t => t.trim());
    if (data.curriculum && typeof data.curriculum === 'string') data.curriculum = JSON.parse(data.curriculum);
    const course = await Course.findByIdAndUpdate(req.params.id, data, { new: true });
    res.json(course);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/admin/courses/:id', authMiddleware, async (req, res) => {
  await Course.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

// ============================================================
// ROUTES — INSTRUCTORS
// ============================================================
app.get('/api/instructors', async (req, res) => {
  res.json(await Instructor.find({ published: true }).sort({ createdAt: -1 }));
});

app.get('/api/admin/instructors', authMiddleware, async (req, res) => {
  res.json(await Instructor.find().sort({ createdAt: -1 }));
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
  await Instructor.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

// ============================================================
// ROUTES — TESTIMONIALS
// ============================================================
app.get('/api/testimonials', async (req, res) => {
  res.json(await Testimonial.find({ published: true }).sort({ createdAt: -1 }));
});

app.get('/api/admin/testimonials', authMiddleware, async (req, res) => {
  res.json(await Testimonial.find().sort({ createdAt: -1 }));
});

app.post('/api/admin/testimonials', authMiddleware, upload.single('avatar'), async (req, res) => {
  const data = { ...req.body };
  if (req.file) data.avatar = req.file.path;
  const t = new Testimonial(data);
  await t.save();
  res.json(t);
});

app.put('/api/admin/testimonials/:id', authMiddleware, upload.single('avatar'), async (req, res) => {
  const data = { ...req.body };
  if (req.file) data.avatar = req.file.path;
  const t = await Testimonial.findByIdAndUpdate(req.params.id, data, { new: true });
  res.json(t);
});

app.delete('/api/admin/testimonials/:id', authMiddleware, async (req, res) => {
  await Testimonial.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

// ============================================================
// ROUTES — NOTICES/POPUPS
// ============================================================
app.get('/api/notices', async (req, res) => {
  res.json(await Notice.find({ active: true }));
});

app.get('/api/admin/notices', authMiddleware, async (req, res) => {
  res.json(await Notice.find().sort({ createdAt: -1 }));
});

app.post('/api/admin/notices', authMiddleware, upload.single('image'), async (req, res) => {
  const data = { ...req.body };
  if (req.file) data.imageUrl = req.file.path;
  const n = new Notice(data);
  await n.save();
  res.json(n);
});

app.put('/api/admin/notices/:id', authMiddleware, upload.single('image'), async (req, res) => {
  const data = { ...req.body };
  if (req.file) data.imageUrl = req.file.path;
  const n = await Notice.findByIdAndUpdate(req.params.id, data, { new: true });
  res.json(n);
});

app.delete('/api/admin/notices/:id', authMiddleware, async (req, res) => {
  await Notice.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

// ============================================================
// ROUTES — SITE SETTINGS
// ============================================================
app.get('/api/settings', async (req, res) => {
  const settings = await Settings.find();
  const obj = {};
  settings.forEach(s => { obj[s.key] = s.value; });
  res.json(obj);
});

app.post('/api/admin/settings', authMiddleware, async (req, res) => {
  const updates = req.body; // { key: value, ... }
  for (const [key, value] of Object.entries(updates)) {
    await Settings.findOneAndUpdate({ key }, { key, value, updatedAt: new Date() }, { upsert: true });
  }
  res.json({ message: 'Settings saved' });
});

// Upload image for settings (logo, hero bg, etc.)
app.post('/api/admin/settings/upload', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json({ url: req.file.path });
});

// ============================================================
// ROUTES — ENROLLMENTS
// ============================================================
app.post('/api/enrollments', async (req, res) => {
  const e = new Enrollment(req.body);
  await e.save();
  res.json({ message: 'Enrollment submitted', id: e._id });
});

app.get('/api/admin/enrollments', authMiddleware, async (req, res) => {
  const { status } = req.query;
  let query = {};
  if (status) query.status = status;
  res.json(await Enrollment.find(query).sort({ createdAt: -1 }));
});

app.put('/api/admin/enrollments/:id', authMiddleware, async (req, res) => {
  const e = await Enrollment.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(e);
});

app.delete('/api/admin/enrollments/:id', authMiddleware, async (req, res) => {
  await Enrollment.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

// ============================================================
// ROUTES — DASHBOARD STATS
// ============================================================
app.get('/api/admin/stats', authMiddleware, async (req, res) => {
  const [courses, instructors, testimonials, enrollments] = await Promise.all([
    Course.countDocuments(),
    Instructor.countDocuments(),
    Testimonial.countDocuments(),
    Enrollment.countDocuments(),
  ]);
  const pendingEnrollments = await Enrollment.countDocuments({ status: 'pending' });
  const totalRevenue = await Enrollment.aggregate([
    { $match: { status: 'approved' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  res.json({
    courses,
    instructors,
    testimonials,
    enrollments,
    pendingEnrollments,
    revenue: totalRevenue[0]?.total || 0,
  });
});

// ── Upload image (standalone) ──
app.post('/api/admin/upload', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: req.file.path, public_id: req.file.filename });
});

// ── Root ──
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Ibn Khaldun Institute server running on http://localhost:${PORT}`);
  console.log(`📋 Admin Panel: http://localhost:${PORT}/admin`);
  console.log(`🌐 Frontend: http://localhost:${PORT}/frontend`);
});
