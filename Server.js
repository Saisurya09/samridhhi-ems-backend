const express = require("express");
const cors = require("cors");

const nodemailer = require("nodemailer");
const { Sequelize, DataTypes } = require("sequelize");
const multer = require("multer");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const fs = require("fs");
const os = require("os");

const app = express();
app.use(cors());
app.use(express.json());

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve static files from uploads directory
app.use("/uploads", express.static(uploadsDir));

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = file.mimetype
      ? allowedTypes.test(file.mimetype.toLowerCase())
      : false;
    if (extname && (mimetype || !file.mimetype)) {
      return cb(null, true);
    } else {
      cb(new Error("Only images (jpeg, jpg, png) and PDFs are allowed!"));
    }
  },
});

let emailTransporter = null;
async function getEmailTransporter() {
  if (emailTransporter) return emailTransporter;
  const smtpUser = process.env.SMTP_USER || "saisuryaambati090705@gmail.com";
  const smtpPass = process.env.SMTP_PASS || "Qwerty@410";

  if (process.env.SMTP_HOST && smtpUser && smtpPass) {
    emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
  } else if (smtpUser && smtpPass) {
    emailTransporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
  } else {
    const testAccount = await nodemailer.createTestAccount();
    emailTransporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }
  return emailTransporter;
}

async function sendResetOtpEmail(to, otp, name) {
  const transporter = await getEmailTransporter();
  const mail = {
    from: "saisuryaambati090705@gmail.com",
    to,
    subject: "Your password reset OTP",
    text: `Hello ${name},\n\nYour OTP to reset the password is ${otp}. It expires in 15 minutes.\n\nIf you did not request this, please ignore this email.`,
    html: `<p>Hello ${name},</p><p>Your OTP to reset the password is <strong>${otp}</strong>. It expires in 15 minutes.</p><p>If you did not request this, please ignore this email.</p>`,
  };

  const info = await transporter.sendMail(mail);
  const previewUrl = !process.env.SMTP_HOST
    ? nodemailer.getTestMessageUrl(info)
    : null;
  if (previewUrl) {
    console.log("Password reset email preview URL:", previewUrl);
  }
  return { info, previewUrl };
}

// Initialize Sequelize
// Replace 'root' and 'password' with your actual MySQL username and password
// Make sure the database 'ems' exists in your MySQL server
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "mysql",
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  }
);

// --- Models ---

const Employee = sequelize.define("Employee", {
  employeeId: { type: DataTypes.STRING, primaryKey: true },
  password: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING },
  resetOtp: { type: DataTypes.STRING },
  resetOtpExpiry: { type: DataTypes.DATE },
  phone: { type: DataTypes.STRING },
  bio: { type: DataTypes.TEXT },
  workMode: { type: DataTypes.STRING },
  role: { type: DataTypes.STRING, allowNull: false },
  title: { type: DataTypes.STRING },
  department: { type: DataTypes.STRING },
  location: { type: DataTypes.STRING },
  reportingTo: { type: DataTypes.STRING },
  joinDate: { type: DataTypes.DATE },
  avatar: { type: DataTypes.STRING },
});

const Leave = sequelize.define("Leave", {
  employeeId: { type: DataTypes.STRING, allowNull: false },
  type: { type: DataTypes.STRING },
  startDate: { type: DataTypes.DATE },
  endDate: { type: DataTypes.DATE },
  reason: { type: DataTypes.TEXT },
  status: { type: DataTypes.STRING, defaultValue: "Pending" },
  appliedOn: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});

const Payroll = sequelize.define("Payroll", {
  employeeId: { type: DataTypes.STRING, allowNull: false },
  month: { type: DataTypes.STRING },
  year: { type: DataTypes.INTEGER },
  basic: { type: DataTypes.FLOAT },
  allowances: { type: DataTypes.FLOAT },
  deductions: { type: DataTypes.FLOAT },
  netPay: { type: DataTypes.FLOAT },
  status: { type: DataTypes.STRING },
});

const Attendance = sequelize.define("Attendance", {
  employeeId: { type: DataTypes.STRING, allowNull: false },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  checkIn: { type: DataTypes.DATE },
  checkOut: { type: DataTypes.DATE },
  status: { type: DataTypes.STRING },
  duration: { type: DataTypes.STRING },
  approvalStatus: { type: DataTypes.STRING, defaultValue: "Pending" },
  reviewedBy: { type: DataTypes.STRING },
  reviewedAt: { type: DataTypes.DATE },
  reviewRemark: { type: DataTypes.TEXT },
});

const Task = sequelize.define("Task", {
  employeeId: { type: DataTypes.STRING, allowNull: false },
  title: { type: DataTypes.STRING },
  description: { type: DataTypes.TEXT },
  status: { type: DataTypes.STRING, defaultValue: "In Progress" },
  priority: { type: DataTypes.STRING },
  dueDate: { type: DataTypes.DATE },
  assignedBy: { type: DataTypes.STRING },
});

const Expense = sequelize.define("Expense", {
  employeeId: { type: DataTypes.STRING, allowNull: false },
  amount: { type: DataTypes.FLOAT },
  category: { type: DataTypes.STRING },
  description: { type: DataTypes.TEXT },
  status: { type: DataTypes.STRING, defaultValue: "Pending" },
  date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  billFile: { type: DataTypes.STRING }, // Path to uploaded bill file
  reviewedBy: { type: DataTypes.STRING },
  reviewedAt: { type: DataTypes.DATE },
  reviewRemark: { type: DataTypes.TEXT },
});

const Notification = sequelize.define("Notification", {
  userId: { type: DataTypes.STRING, allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
  type: { type: DataTypes.STRING, defaultValue: "expense" },
});

// --- Relationships ---
Employee.hasMany(Leave, { foreignKey: "employeeId" });
Leave.belongsTo(Employee, { foreignKey: "employeeId" });

Employee.hasMany(Payroll, { foreignKey: "employeeId" });
Payroll.belongsTo(Employee, { foreignKey: "employeeId" });

Employee.hasMany(Attendance, { foreignKey: "employeeId" });
Attendance.belongsTo(Employee, { foreignKey: "employeeId" });

Employee.hasMany(Task, { foreignKey: "employeeId" });
Task.belongsTo(Employee, { foreignKey: "employeeId" });

Employee.hasMany(Expense, { foreignKey: "employeeId" });
Expense.belongsTo(Employee, { foreignKey: "employeeId" });

Employee.hasMany(Notification, { foreignKey: "userId" });
Notification.belongsTo(Employee, { foreignKey: "userId" });

// Sync DB
sequelize
  .sync({ alter: true })
  .then(async () => {
    console.log("MySQL Database & tables synced successfully!");

    // Database Seeding
    const count = await Employee.count();
    if (count === 0) {
      console.log("Seeding initial predefined users...");
      const PREDEFINED_USERS = [
        {
          id: "ceo-1",
          name: "Kaushal Chintawar",
          role: "ceo",
          title: "Chief Executive Officer",
          department: "Executive Office",
          avatar: "KC",
          employeeId: "EMP-0001",
          location: "Hyderabad HQ",
          reportingTo: "Board of Directors",
          joinDate: "2018-01-01",
        },
        {
          id: "gm-1",
          name: "Praveen",
          role: "gm",
          title: "General Manager",
          department: "Operations",
          avatar: "PR",
          employeeId: "EMP-0010",
          location: "Hyderabad HQ",
          reportingTo: "Kaushal Chintawar",
          joinDate: "2019-03-15",
        },
        {
          id: "gm-2",
          name: "Varad",
          role: "gm",
          title: "General Manager",
          department: "Technology",
          avatar: "VA",
          employeeId: "EMP-0011",
          location: "Hyderabad HQ",
          reportingTo: "Kaushal Chintawar",
          joinDate: "2019-06-01",
        },
        {
          id: "gm-3",
          name: "Ramakrishna",
          role: "gm",
          title: "General Manager",
          department: "Business Dev",
          avatar: "RK",
          employeeId: "EMP-0012",
          location: "Hyderabad HQ",
          reportingTo: "Kaushal Chintawar",
          joinDate: "2019-09-10",
        },
        {
          id: "hr-1",
          name: "Krishna",
          role: "hr",
          title: "HR Manager",
          department: "Human Resources",
          avatar: "KR",
          employeeId: "EMP-0020",
          location: "Hyderabad HQ",
          reportingTo: "Kaushal Chintawar",
          joinDate: "2020-04-12",
        },
        {
          id: "hr-2",
          name: "Ramesh",
          role: "hr",
          title: "HR Manager",
          department: "Human Resources",
          avatar: "RM",
          employeeId: "EMP-0021",
          location: "Hyderabad HQ",
          reportingTo: "Kaushal Chintawar",
          joinDate: "2020-07-05",
        },
        {
          id: "hr-3",
          name: "Supriya",
          role: "hr",
          title: "HR Specialist",
          department: "Human Resources",
          avatar: "SU",
          employeeId: "EMP-0022",
          location: "Hyderabad HQ",
          reportingTo: "",
          joinDate: "2020-11-20",
        },
        {
          id: "tl-1",
          name: "Sharuk",
          role: "tl",
          title: "Team Leader",
          department: "Product Engineering",
          avatar: "SH",
          employeeId: "EMP-0030",
          location: "Hyderabad HQ",
          reportingTo: "Varad",
          joinDate: "2021-02-14",
        },
        {
          id: "tl-2",
          name: "Sai Surya",
          role: "tl",
          title: "Team Leader",
          department: "Frontend Dev",
          avatar: "SS",
          employeeId: "EMP-0031",
          location: "Hyderabad HQ",
          reportingTo: "Varad",
          joinDate: "2021-03-01",
        },
        {
          id: "tl-3",
          name: "Sathvik",
          role: "tl",
          title: "Team Leader",
          department: "Backend Systems",
          avatar: "SA",
          employeeId: "EMP-0032",
          location: "Hyderabad HQ",
          reportingTo: "Varad",
          joinDate: "2021-05-10",
        },
        {
          id: "tl-4",
          name: "Pooja",
          role: "tl",
          title: "Team Leader",
          department: "Design & UX",
          avatar: "PO",
          employeeId: "EMP-0033",
          location: "Hyderabad HQ",
          reportingTo: "Varad",
          joinDate: "2021-08-22",
        },
        {
          id: "tl-5",
          name: "Srinivas",
          role: "tl",
          title: "Team Leader",
          department: "QA & Testing",
          avatar: "SR",
          employeeId: "EMP-0034",
          location: "Hyderabad HQ",
          reportingTo: "Varad",
          joinDate: "2021-10-05",
        },
        {
          id: "tl-6",
          name: "Vyaijeshwar",
          role: "tl",
          title: "Team Leader",
          department: "DevOps & Infra",
          avatar: "VY",
          employeeId: "EMP-0035",
          location: "Hyderabad HQ",
          reportingTo: "Varad",
          joinDate: "2021-12-01",
        },
        {
          id: "emp-1",
          name: "Harshith",
          role: "employee",
          title: "Software Engineer",
          department: "Frontend Dev",
          avatar: "HA",
          employeeId: "EMP-1001",
          location: "Hyderabad HQ",
          reportingTo: "Sai Surya",
          joinDate: "2023-01-10",
        },
        {
          id: "emp-2",
          name: "Siddharth",
          role: "employee",
          title: "Software Engineer",
          department: "Backend Systems",
          avatar: "SI",
          employeeId: "EMP-1002",
          location: "Hyderabad HQ",
          reportingTo: "Sathvik",
          joinDate: "2023-02-20",
        },
        {
          id: "emp-3",
          name: "Shrutika",
          role: "employee",
          title: "UI/UX Designer",
          department: "Design & UX",
          avatar: "SK",
          employeeId: "EMP-1003",
          location: "Hyderabad HQ",
          reportingTo: "Pooja",
          joinDate: "2023-03-15",
        },
        {
          id: "emp-4",
          name: "Sathwik",
          role: "employee",
          title: "QA Engineer",
          department: "QA & Testing",
          avatar: "SW",
          employeeId: "EMP-1004",
          location: "Hyderabad HQ",
          reportingTo: "Srinivas",
          joinDate: "2023-04-01",
        },
      ];
      for (const u of PREDEFINED_USERS) {
        await Employee.create({
          employeeId: u.employeeId,
          name: u.name,
          email: u.email || `${u.employeeId.toLowerCase()}@samridhhi.com`,
          password: "admin123", // Default password for all predefined users
          role: u.role,
          title: u.title,
          department: u.department,
          location: u.location,
          reportingTo: u.reportingTo,
          avatar: u.avatar,
          joinDate: new Date(u.joinDate),
        });
      }
      console.log("Seeding completed!");
    }
  })
  .catch((err) => {
    console.error("Error syncing MySQL database:", err);
  });

// --- Routes ---

// Auth Routes
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, employeeId, email, password, role } = req.body;
    if (!name || !employeeId || !email || !password) {
      return res
        .status(400)
        .json({ error: "Name, employee ID, email and password are required" });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ error: "Invalid email address" });
    }
    const existing = await Employee.findByPk(employeeId);
    if (existing) {
      return res.status(400).json({ error: "Employee ID already exists" });
    }
    const existingEmail = await Employee.findOne({
      where: { email: normalizedEmail },
    });
    if (existingEmail) {
      return res.status(400).json({ error: "Email is already in use" });
    }
    const emp = await Employee.create({
      employeeId,
      name,
      email: normalizedEmail,
      password,
      role: role || "employee",
    });
    res.status(201).json({ message: "User created successfully", user: emp });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { employeeId, password } = req.body;
    const user = await Employee.findByPk(employeeId);
    if (!user || user.password !== password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    res.json({ message: "Login successful", user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/auth/profile/:employeeId", async (req, res) => {
  try {
    const user = await Employee.findByPk(req.params.employeeId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/auth/profile/:employeeId", async (req, res) => {
  try {
    const updates = req.body;
    const user = await Employee.findByPk(req.params.employeeId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const allowed = [
      "name",
      "email",
      "phone",
      "bio",
      "workMode",
      "title",
      "department",
      "location",
      "reportingTo",
      "avatar",
      "joinDate",
      "role",
    ];
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        user[key] = updates[key];
      }
    }
    await user.save();
    res.json({ message: "Profile updated successfully", user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/auth/change-password", async (req, res) => {
  try {
    const { employeeId, currentPassword, newPassword } = req.body;
    if (!employeeId || !currentPassword || !newPassword) {
      return res.status(400).json({
        error: "employeeId, currentPassword and newPassword are required",
      });
    }
    if (newPassword.length < 4) {
      return res
        .status(400)
        .json({ error: "New password must be at least 4 characters" });
    }
    const user = await Employee.findByPk(employeeId);
    if (!user || user.password !== currentPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    user.password = newPassword;
    await user.save();
    res.json({ message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }
    const user = await Employee.findOne({ where: { email } });
    if (!user) {
      return res.json({
        message: "If an account exists, an OTP has been sent.",
      });
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetOtp = otp;
    user.resetOtpExpiry = new Date(Date.now() + 1000 * 60 * 15);
    await user.save();

    try {
      const result = await sendResetOtpEmail(
        user.email,
        otp,
        user.name || "Employee",
      );
      const response = {
        message: "If an account exists, an OTP has been sent.",
      };
      if (result.previewUrl) response.previewUrl = result.previewUrl;
      res.json(response);
      return;
    } catch (emailError) {
      console.error("OTP email delivery failed:", emailError);
      return res.status(500).json({ error: "Failed to send OTP email" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res
        .status(400)
        .json({ error: "Email, OTP and newPassword are required" });
    }
    if (newPassword.length < 4) {
      return res
        .status(400)
        .json({ error: "New password must be at least 4 characters" });
    }
    const user = await Employee.findOne({ where: { email } });
    if (
      !user ||
      !user.resetOtp ||
      user.resetOtp !== otp ||
      !user.resetOtpExpiry ||
      new Date() > new Date(user.resetOtpExpiry)
    ) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }
    user.password = newPassword;
    user.resetOtp = null;
    user.resetOtpExpiry = null;
    await user.save();
    res.json({ message: "Password reset successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Employee Routes
app.get("/employee/all", async (req, res) => {
  try {
    const data = await Employee.findAll();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Feature Routes
app.get("/leaves/:employeeId", async (req, res) => {
  try {
    const leaves = await Leave.findAll({
      where: { employeeId: req.params.employeeId },
    });
    res.json(leaves);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/leaves", async (req, res) => {
  try {
    const leaves = await Leave.findAll({
      order: [["appliedOn", "DESC"]],
      include: [
        {
          model: Employee,
          attributes: ["employeeId", "name", "role", "department"],
        },
      ],
    });
    res.json(leaves);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/leaves/add", async (req, res) => {
  try {
    const leave = await Leave.create(req.body);
    res.status(201).json(leave);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/leaves/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    if (!["Approved", "Pending", "Rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }
    const leave = await Leave.findByPk(req.params.id);
    if (!leave) {
      return res.status(404).json({ error: "Leave request not found" });
    }
    leave.status = status;
    await leave.save();

    await Notification.create({
      userId: leave.employeeId,
      message: `Your leave request from ${leave.startDate?.toISOString().split("T")[0] || "N/A"} to ${leave.endDate?.toISOString().split("T")[0] || "N/A"} has been ${status.toLowerCase()}.`,
      isRead: false,
      type: "leave",
    });

    res.json(leave);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/leaves/:id", async (req, res) => {
  try {
    const leave = await Leave.findByPk(req.params.id);
    if (!leave) {
      return res.status(404).json({ error: "Leave request not found" });
    }
    await leave.destroy();
    res.json({ message: "Leave deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/payroll/:employeeId", async (req, res) => {
  try {
    const payrolls = await Payroll.findAll({
      where: { employeeId: req.params.employeeId },
    });
    res.json(payrolls);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/attendance/:employeeId", async (req, res) => {
  try {
    const records = await Attendance.findAll({
      where: { employeeId: req.params.employeeId },
      order: [["date", "DESC"]],
    });
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/attendance", async (req, res) => {
  try {
    const records = await Attendance.findAll({
      order: [
        ["date", "DESC"],
        ["createdAt", "DESC"],
      ],
      include: [
        {
          model: Employee,
          attributes: ["employeeId", "name", "role", "department"],
        },
      ],
    });
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/attendance/checkin", async (req, res) => {
  try {
    const { employeeId } = req.body;
    const date = new Date().toISOString().split("T")[0];
    let record = await Attendance.findOne({ where: { employeeId, date } });
    if (!record) {
      record = await Attendance.create({
        employeeId,
        date,
        checkIn: new Date(),
        status: "present",
        approvalStatus: "Pending",
      });
    }
    res.json(record);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/attendance/checkout", async (req, res) => {
  try {
    const { employeeId } = req.body;
    const date = new Date().toISOString().split("T")[0];
    let record = await Attendance.findOne({ where: { employeeId, date } });
    if (record && !record.checkOut) {
      record.checkOut = new Date();
      const diffMs = record.checkOut - record.checkIn;
      const diffHrs = (diffMs / (1000 * 60 * 60)).toFixed(2);
      record.duration = diffHrs + "h";
      const checkInHour = new Date(record.checkIn).getHours();
      const checkInMin = new Date(record.checkIn).getMinutes();
      record.status =
        checkInHour > 9 || (checkInHour === 9 && checkInMin > 30)
          ? "late"
          : "present";
      record.approvalStatus = "Pending";
      await record.save();
    }
    res.json(record);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/attendance/:id/review", async (req, res) => {
  try {
    const { reviewerEmployeeId, approvalStatus, reviewRemark } = req.body;
    if (!reviewerEmployeeId || !approvalStatus) {
      return res
        .status(400)
        .json({ error: "reviewerEmployeeId and approvalStatus are required" });
    }
    if (!["Approved", "Rejected", "Pending"].includes(approvalStatus)) {
      return res.status(400).json({ error: "Invalid approvalStatus value" });
    }
    const reviewer = await Employee.findByPk(reviewerEmployeeId);
    if (!reviewer || reviewer.role !== "hr") {
      return res
        .status(403)
        .json({ error: "Only HR users can review attendance" });
    }
    const record = await Attendance.findByPk(req.params.id);
    if (!record) {
      return res.status(404).json({ error: "Attendance record not found" });
    }
    record.approvalStatus = approvalStatus;
    record.reviewedBy = reviewerEmployeeId;
    record.reviewedAt = new Date();
    record.reviewRemark = reviewRemark || null;
    await record.save();
    res.json(record);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/tasks/:employeeId", async (req, res) => {
  try {
    const tasks = await Task.findAll({
      where: { employeeId: req.params.employeeId },
    });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/expenses/:employeeId", async (req, res) => {
  try {
    const expenses = await Expense.findAll({
      where: { employeeId: req.params.employeeId },
      order: [["date", "DESC"]],
      include: [
        {
          model: Employee,
          attributes: ["employeeId", "name", "role", "department"],
        },
      ],
    });
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/expenses/add", upload.single("billFile"), async (req, res) => {
  try {
    const { employeeId, amount, category, description } = req.body;
    if (!employeeId || !amount || !category || !description) {
      return res.status(400).json({
        error: "employeeId, amount, category and description are required",
      });
    }

    const billFile = req.file ? req.file.filename : null;
    const expense = await Expense.create({
      employeeId,
      amount: parseFloat(amount),
      category,
      description,
      billFile,
      status: "Pending",
    });

    const expenseData = expense.toJSON();
    if (expenseData.billFile) {
     expenseData.billFileUrl = `${req.protocol}://${req.get('host')}/uploads/${expenseData.billFile}`;
    }
    res.status(201).json(expenseData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/expenses", async (req, res) => {
  try {
    const expenses = await Expense.findAll({
      order: [["date", "DESC"]],
      include: [
        {
          model: Employee,
          attributes: ["employeeId", "name", "role", "department"],
        },
      ],
    });
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/expenses/:id/review", async (req, res) => {
  try {
    const { reviewerEmployeeId, status, reviewRemark } = req.body;
    if (!reviewerEmployeeId || !status) {
      return res
        .status(400)
        .json({ error: "reviewerEmployeeId and status are required" });
    }
    if (!["Approved", "Rejected", "Pending"].includes(status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }
    const reviewer = await Employee.findByPk(reviewerEmployeeId);
    if (!reviewer || reviewer.role !== "gm") {
      return res
        .status(403)
        .json({ error: "Only GM users can review expenses" });
    }
    const expense = await Expense.findByPk(req.params.id);
    if (!expense) {
      return res.status(404).json({ error: "Expense not found" });
    }
    expense.status = status;
    expense.reviewedBy = reviewerEmployeeId;
    expense.reviewedAt = new Date();
    expense.reviewRemark = reviewRemark || null;
    await expense.save();

    const message =
      status === "Approved"
        ? `Your expense bill for ₹${expense.amount.toFixed(2)} has been approved.`
        : `Your expense bill for ₹${expense.amount.toFixed(2)} has been rejected.${reviewRemark ? ` Reason: ${reviewRemark}` : ""}`;

    await Notification.create({
      userId: expense.employeeId,
      message,
      isRead: false,
      type: "expense",
    });

    res.json(expense);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/notifications/:employeeId", async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      where: { userId: req.params.employeeId },
      order: [["createdAt", "DESC"]],
    });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/notifications/:employeeId", async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      where: { userId: req.params.employeeId },
      order: [["createdAt", "DESC"]],
    });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Task Routes ---
app.get("/tasks/:employeeId", async (req, res) => {
  try {
    const tasks = await Task.findAll({
      where: { employeeId: req.params.employeeId },
      order: [["createdAt", "DESC"]],
    });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/tasks/assigned-by/:tlId", async (req, res) => {
  try {
    const tasks = await Task.findAll({
      where: { assignedBy: req.params.tlId },
      order: [["createdAt", "DESC"]],
      include: [{ model: Employee, attributes: ["name", "avatar", "role"] }],
    });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/tasks", async (req, res) => {
  try {
    const { employeeId, title, description, priority, dueDate, assignedBy } = req.body;
    const task = await Task.create({
      employeeId,
      title,
      description,
      priority,
      dueDate,
      assignedBy,
    });
    
    // Notify the employee
    const assigner = await Employee.findByPk(assignedBy);
    const assignerName = assigner ? assigner.name : "your Team Leader";
    await Notification.create({
      userId: employeeId,
      message: `You have been assigned a new task: "${title}" by ${assignerName}.`,
      isRead: false,
      type: "task",
    });

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/tasks/:id/complete", async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    task.status = "Completed";
    await task.save();

    // Notify the assigner (Team Leader)
    if (task.assignedBy) {
      const assignee = await Employee.findByPk(task.employeeId);
      const assigneeName = assignee ? assignee.name : "An employee";
      await Notification.create({
        userId: task.assignedBy,
        message: `${assigneeName} has completed the task: "${task.title}".`,
        isRead: false,
        type: "task",
      });
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.log("Available on:");
  const networkInterfaces = os.networkInterfaces();
  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName];
    for (const iface of interfaces) {
      if (iface.family === "IPv4" && !iface.internal) {
        console.log(`  http://${iface.address}:${PORT}`);
      }
    }
  }
});
