require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'your-fallback-secret';

app.use(cors());
app.use(bodyParser.json());

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Multer storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    cb(null, base + '-' + Date.now() + ext);
  }
});
const upload = multer({ storage });

// Serve uploads statically
app.use('/uploads', express.static(uploadDir));

// Image upload endpoint
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = '/uploads/' + req.file.filename;
  res.json({ url });
});

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://vanshbhatt2527:S0krtUW79YXdfLys@cluster0.eaknngj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

// User schema/model
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  password: String,
  role: { type: String, default: 'user' } // 'user' or 'admin'
});
const User = mongoose.model('User', userSchema);

// Order schema/model
const orderSchema = new mongoose.Schema({
  user: String, // user email or userId
  phone: String,
  email: String,
  name: String,
  address: String,
  pincode: String,
  city: String,
  state: String,
  payment: String,
  upi: String,
  cart: Array,
  total: Number,
  status: { type: String, default: 'pending' }
});
const Order = mongoose.model('Order', orderSchema);

// Product schema/model
const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  img: String,
  rating: String,
  badge: String,
  original: Number,
  description: String,
  images: [String],
  sku: String
});
const Product = mongoose.model('Product', productSchema);

// Offer schema/model
const offerSchema = new mongoose.Schema({
  title: String,
  subtitle: String,
  image: String, // URL to offer image
  link: String,  // Optional: link for CTA
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});
const Offer = mongoose.model('Offer', offerSchema);

// Review schema/model
const reviewSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: String,
  email: String, // Add email field
  rating: Number,
  comment: String,
  createdAt: { type: Date, default: Date.now }
});
const Review = mongoose.model('Review', reviewSchema);

// Get reviews for a product
app.get('/api/reviews/:productId', async (req, res) => {
  const { productId } = req.params;
  try {
    const reviews = await Review.find({ productId }).sort({ createdAt: -1 });
    res.json(reviews);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Post a review for a product (requires login, rating or comment optional)
app.post('/api/reviews/:productId', async (req, res) => {
  const { productId } = req.params;
  const { name, email, rating, comment } = req.body;
  let token = req.headers.authorization;
  if (!token && req.body.token) token = req.body.token;
  if (token && token.startsWith('Bearer ')) token = token.slice(7);
  if (!token) return res.status(401).json({ error: 'Login required' });
  if (!name && !rating && !comment) {
    return res.status(400).json({ error: 'No review data provided' });
  }
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const user = await User.findOne({ email: decoded.email });
    if (!user) return res.status(401).json({ error: 'Invalid user' });
    // Only create review if at least one field is present
    const review = await Review.create({
      productId,
      name: name || user.email,
      email: email || user.email,
      rating: rating || undefined,
      comment: comment || ''
    });
    res.json({ success: true, review });
  } catch (e) {
    console.log('Review error:', e);
    res.status(400).json({ error: e.message || 'Could not submit review' });
  }
});

// Get all products
app.get('/api/products', async (req, res) => {
  const products = await Product.find();
  res.json(products);
});

// Update all products (admin, replaces all)
app.post('/api/products', async (req, res) => {
  if (!Array.isArray(req.body) || req.body.length === 0) {
    return res.status(400).json({ error: 'Invalid product data' });
  }
  await Product.deleteMany({});
  await Product.insertMany(req.body);
  res.json({ success: true });
});

// Add a new product
app.post('/api/products/add', async (req, res) => {
  const { token, product } = req.body;
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const user = await User.findOne({ email: decoded.email });
    if (!user || user.role !== 'admin') return res.status(401).json({ error: 'Unauthorized' });
    if (!product || typeof product !== 'object') return res.status(400).json({ error: 'Invalid product data' });
    const newProduct = await Product.create(product);
    res.json({ success: true, product: newProduct });
  } catch (e) {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

// Edit a product by ID
app.put('/api/products/:id', async (req, res) => {
  const { token, product } = req.body;
  const id = req.params.id;
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const user = await User.findOne({ email: decoded.email });
    if (!user || user.role !== 'admin') return res.status(401).json({ error: 'Unauthorized' });
    if (!product || typeof product !== 'object') return res.status(400).json({ error: 'Invalid product data' });
    const updated = await Product.findByIdAndUpdate(id, product, { new: true });
    res.json({ success: true, product: updated });
  } catch (e) {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

// Delete a product by ID
app.delete('/api/products/:id', async (req, res) => {
  const { token } = req.body;
  const id = req.params.id;
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const user = await User.findOne({ email: decoded.email });
    if (!user || user.role !== 'admin') return res.status(401).json({ error: 'Unauthorized' });
    await Product.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (e) {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

// One-time endpoint to seed initial products if collection is empty
app.post('/api/products/seed', async (req, res) => {
  const count = await Product.countDocuments();
  if (count > 0) return res.json({ message: 'Products already seeded.' });
  const initialProducts = [
    { name: 'Himalayan Shilajit Resin', price: 999, img: 'public/uploads/Screenshot 2025-05-29 192943-1751998070990.png', rating: '4.3/5 (4846)', badge: '33% OFF', original: 1499, description: 'Himalayan Shilajit Resin is a pure, potent and natural source of energy extracted from the pristine Himalayan ranges. Rich in fulvic acid, minerals, and antioxidants, it helps boost stamina, immunity, and overall vitality. Ideal for those seeking traditional Ayurvedic wellness in a concentrated form.' },
    { name: 'Shilajit Energy Mix', price: 999, img: 'public/uploads/Screenshot 2025-05-29 212205-1751987678766.png', rating: '4.5/5 (110)', badge: '9% OFF', original: 1099, description: 'Shilajit Energy Mix blends premium Shilajit with herbs and nutrients for enhanced energy, endurance, and focus. A perfect addition to daily wellness routines, this mix supports active lifestyles, fitness performance, and metabolic health.' },
    { name: 'Shilajit Energy Sips', price: 999, img: 'public/uploads/Screenshot 2025-06-05 132150-1751996866740.png', rating: '4.5/5 (53)', badge: '29% OFF', original: 1399, description: 'Shilajit Energy Sips are ready-to-consume liquid shots infused with potent Shilajit and energizing herbs. Designed for modern lifestyles, they offer a quick boost in stamina and focus without the hassle of preparation. Ideal for travel, work, or workouts.' },
    { name: 'Shilajit Energy Capsules', price: 1199, img: 'public/uploads/Screenshot 2025-06-07 003410-1751997758193.png', rating: '4.3/5 (23)', badge: '14% OFF', original: 1399, description: 'Shilajit Energy Capsules provide a fast-acting, convenient solution for increasing energy and vitality. Enriched with natural Shilajit and Ayurvedic herbs, these capsules are perfect for professionals and athletes who prefer an easy-to-swallow format without any preparation.' }
  ];
  await Product.insertMany(initialProducts);
  res.json({ message: 'Products seeded.' });
});

// Get all offers (admin or public)
app.get('/api/offers', async (req, res) => {
  const offers = await Offer.find().sort({ createdAt: -1 });
  res.json(offers);
});

// Add a new offer (admin only)
app.post('/api/offers/add', async (req, res) => {
  const { token, offer } = req.body;
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const user = await User.findOne({ email: decoded.email });
    if (!user || user.role !== 'admin') return res.status(401).json({ error: 'Unauthorized' });
    if (!offer || typeof offer !== 'object') return res.status(400).json({ error: 'Invalid offer data' });
    const newOffer = await Offer.create(offer);
    res.json({ success: true, offer: newOffer });
  } catch (e) {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

// Edit an offer by ID (admin only)
app.put('/api/offers/:id', async (req, res) => {
  const { token, offer } = req.body;
  const id = req.params.id;
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const user = await User.findOne({ email: decoded.email });
    if (!user || user.role !== 'admin') return res.status(401).json({ error: 'Unauthorized' });
    if (!offer || typeof offer !== 'object') return res.status(400).json({ error: 'Invalid offer data' });
    const updated = await Offer.findByIdAndUpdate(id, offer, { new: true });
    res.json({ success: true, offer: updated });
  } catch (e) {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

// Delete an offer by ID (admin only)
app.delete('/api/offers/:id', async (req, res) => {
  const { token } = req.body;
  const id = req.params.id;
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const user = await User.findOne({ email: decoded.email });
    if (!user || user.role !== 'admin') return res.status(401).json({ error: 'Unauthorized' });
    await Offer.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (e) {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

// User registration
app.post('/api/register', async (req, res) => {
  const { email, password, role } = req.body;
  const hash = await bcrypt.hash(password, 10);
  try {
    const user = await User.create({ email, password: hash, role: role || 'user' });
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: 'User already exists' });
  }
});

// User login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ error: 'Invalid credentials' });
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ email }, SECRET_KEY, { expiresIn: '1d' });
  res.json({ token });
});

// Place order
app.post('/api/orders', async (req, res) => {
  let token = req.body.token;
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  const { phone, email, name, address, pincode, city, state, payment, upi, cart, total } = req.body;
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    // Fetch products to ensure we have _id for each cart item
    const allProducts = await Product.find();
    const cartWithIds = (cart || []).map(item => {
      // Try to find the product by name (or sku if available)
      const prod = allProducts.find(p => p.name === item.name || (item.sku && p.sku === item.sku));
      return {
        _id: prod ? prod._id : undefined,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        img: item.img || '',
        sku: item.sku || '',
        // ...add any other fields as needed
      };
    });
    const order = await Order.create({
      user: decoded.email,
      phone,
      email,
      name,
      address,
      pincode,
      city,
      state,
      payment,
      upi,
      cart: cartWithIds,
      total
    });
    res.json({ success: true, orderId: order._id });
  } catch (e) {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

// Get orders for a user or admin
app.get('/api/orders', async (req, res) => {
  const { token } = req.query;
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const user = await User.findOne({ email: decoded.email });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (user.role === 'admin') {
      // Admin: return all orders
      const orders = await Order.find();
      res.json(orders);
    } else {
      // Regular user: only their orders
      const orders = await Order.find({ user: decoded.email });
      res.json(orders);
    }
  } catch (e) {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

// Get orders for the currently logged-in user
app.get('/api/my-orders', async (req, res) => {
  let token = null;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return res.status(401).json([]);
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const orders = await Order.find({ user: decoded.email }).sort({ _id: -1 });
    res.json(orders);
  } catch (e) {
    res.status(401).json([]);
  }
});

// Get a specific order by ID (for order summary)
app.get('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  const token = req.query.token || (req.headers.authorization && req.headers.authorization.replace('Bearer ', ''));
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const user = await User.findOne({ email: decoded.email });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    // Only allow admin or the user who placed the order
    if (user.role !== 'admin' && order.user !== decoded.email) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(order);
  } catch (e) {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

// --- Order Management Endpoint (Admin Only) ---
// Update order status
app.put('/api/orders/:id', async (req, res) => {
  const { token, status } = req.body;
  const { id } = req.params;
  console.log('PUT /api/orders/:id called');
  console.log('id:', id);
  console.log('token:', token);
  console.log('status:', status);
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const user = await User.findOne({ email: decoded.email });
    if (!user || user.role !== 'admin') return res.status(401).json({ error: 'Unauthorized' });
    const order = await Order.findById(id);
    console.log('order:', order);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    order.status = status;
    await order.save();
    res.json({ success: true, order });
  } catch (e) {
    console.error(e);
    res.status(401).json({ error: 'Unauthorized' });
  }
});

// Shiprocket API credentials (replace with your actual credentials)
const SHIPROCKET_EMAIL = 'YOUR_SHIPROCKET_EMAIL';
const SHIPROCKET_PASSWORD = 'YOUR_SHIPROCKET_PASSWORD';

// Helper: Authenticate with Shiprocket
async function getShiprocketToken() {
  const res = await axios.post('https://apiv2.shiprocket.in/v1/external/auth/login', {
    email: SHIPROCKET_EMAIL,
    password: SHIPROCKET_PASSWORD
  });
  return res.data.token;
}

// Helper: Create Shiprocket Order
async function createShiprocketOrder(order, token) {
  const res = await axios.post(
    'https://apiv2.shiprocket.in/v1/external/orders/create/adhoc',
    order,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data;
}

// API endpoint to create Shiprocket order after successful payment
app.post('/api/shiprocket/create-order', async (req, res) => {
  try {
    const token = await getShiprocketToken();
    const orderData = req.body; // Make sure this matches Shiprocket's order format
    const result = await createShiprocketOrder(orderData, token);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve product.html directly
app.get('/product.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'product.html'));
});

// Fallback to index.html for SPA (must be last)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}); 