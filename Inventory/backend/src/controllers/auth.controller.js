import { hashPassword, User } from "../models/User.js";
import { generateToken } from "../utils/token.js";

export async function register(req, res) {
  try {
    const existingUsers = await User.countDocuments();
    const user = await User.create({
      name: req.body.name,
      email: req.body.email,
      passwordHash: hashPassword(req.body.password),
      role: existingUsers === 0 ? "admin" : req.body.role || "staff"
    });

    res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user)
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

export async function login(req, res) {
  const user = await User.findOne({ email: req.body.email });

  if (!user || !user.verifyPassword(req.body.password || "")) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const token = generateToken(user);

  res.json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
}

export async function getUsers(req, res) {
  const users = await User.find().select("-passwordHash").sort({ createdAt: -1 });
  res.json(users);
}

export async function getMe(req, res) {
  res.json({ user: req.user });
}

