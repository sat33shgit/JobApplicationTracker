import React from 'react';
import { useState, useEffect, useRef } from "react";
import SimpleModal from './components/SimpleModal';
import { normalizeDateToInput, getTodayISO } from './utils/date';
import logger from './utils/logger';
// Helper to format dates in DD-MMM-YYYY, e.g., 05-May-2024
// Parse YYYY-MM-DD strings as local dates (new Date('YYYY-MM-DD') is treated as UTC,
// which can shift the day depending on timezone). This ensures list view matches
// the date input and DB values.
const formatDisplayDate = (isoDate: string) => {
  let date: Date;
  // If value is 'YYYY-MM-DD', construct local date
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    const [y, m, d] = isoDate.split('-').map(Number);
    date = new Date(y, m - 1, d);
  } else {
    date = new Date(isoDate);
  }
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' });
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};
import { motion } from "motion/react";
// Using a simple in-app modal for delete confirmation (avoids ref/portal issues)
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Download, Upload, Plus, Search, Calendar, Briefcase, FileText, Filter, ChevronDown, ChevronUp, X, Edit, Trash2, FileSpreadsheet, ChevronRight } from "lucide-react";

// Initial empty arrays — real data will be loaded from the API on mount
const initialCompanies: Array<{ id: number; name: string }> = [];
const initialApplications: Array<any> = [];

// Status options
const statusOptions = ["Applied", "Interview", "Offer", "Rejected", "Withdrawn"];

// Colors for charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

// Function to generate mock statistics
const generateStats = (applications) => {
  // Get current date
  const now = new Date();
  
  // Daily stats (last 7 days)
  const dailyStats = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateString = date.toISOString().split('T')[0];
    
    const count = applications.filter(app => app.dateApplied === dateString).length;
    dailyStats.push({
      date: formatDisplayDate(date.toISOString()),
      count
    });
  }
  
  // Weekly stats (last 4 weeks)
  const weeklyStats = [];
  for (let i = 3; i >= 0; i--) {
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - (i * 7 + 6));
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() - i * 7);
    
    const count = applications.filter(app => {
      const appDate = new Date(app.dateApplied);
      return appDate >= startDate && appDate <= endDate;
    }).length;
    
    weeklyStats.push({
      week: `Week ${4-i}`,
      count
    });
  }
  
  // Monthly stats (last 6 months)
  const monthlyStats = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - i);
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const year = date.getFullYear();
    
    const startDate = new Date(year, date.getMonth(), 1);
    const endDate = new Date(year, date.getMonth() + 1, 0);
    
    const count = applications.filter(app => {
      const appDate = new Date(app.dateApplied);
      return appDate >= startDate && appDate <= endDate;
    }).length;
    
    monthlyStats.push({
      month,
      count
    });
  }
  
  // Status distribution
  const statusStats = statusOptions.map(status => ({
    name: status,
    value: applications.filter(app => app.status === status).length
  }));
  
  return {
    daily: dailyStats,
    weekly: weeklyStats,
    monthly: monthlyStats,
    status: statusStats,
    total: applications.length
  };
};

// Main component
export default function App() {
  // State
  const [activeTab, setActiveTab] = useState("dashboard");
  const [companies, setCompanies] = useState(initialCompanies);
  const [applications, setApplications] = useState(initialApplications);
  const [stats, setStats] = useState(generateStats(initialApplications));
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // SimpleModal moved to `src/components/SimpleModal.tsx`

  // Load jobs from the API on first render and map them into the app's shape
  useEffect(() => {
    let mounted = true;
    async function loadJobs() {
      try {
        const resp = await fetch('/api/jobs');
        if (!resp.ok) {
          logger.error('Failed to fetch jobs', resp.status);
          return;
        }
        const rows = await resp.json();

        // Build companies map from unique company names
        const companiesMap = new Map();
        let nextCompanyId = 1;
        const apps = rows.map((r) => {
          const companyName = r.company || 'Unknown';
          if (!companiesMap.has(companyName)) {
            companiesMap.set(companyName, nextCompanyId++);
          }
          const companyId = companiesMap.get(companyName);

          const statusRaw = r.status || 'applied';
          const status = typeof statusRaw === 'string' ? (statusRaw.charAt(0).toUpperCase() + statusRaw.slice(1)) : statusRaw;

          // Normalize applied_date to YYYY-MM-DD so daily stats match
          const dateApplied = normalizeDateToInput(r.applied_date);
          return {
            id: r.id,
            companyId,
            role: r.title || '',
            dateApplied,
            status,
            notes: r.metadata?.notes || '',
            files: r.metadata?.files || []
          };
        });

        const companiesArr = Array.from(companiesMap.entries()).map(([name, id]) => ({ id, name }));

        if (mounted) {
          setCompanies(companiesArr);
          setApplications(apps);
        }
      } catch (err) {
        logger.error('Error loading jobs', err);
      }
    }

    loadJobs();
    return () => { mounted = false; };
  }, []);
  const [showAddForm, setShowAddForm] = useState(false);
  const [companyQuery, setCompanyQuery] = useState('');
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const [newApplication, setNewApplication] = useState({
    companyId: "",
    newCompany: "",
    role: "",
    dateApplied: getTodayISO(),
    status: "Applied",
    notes: "",
    files: []
  });
  const [sortConfig, setSortConfig] = useState({ key: 'dateApplied', direction: 'desc' });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTimeframe, setSelectedTimeframe] = useState("daily");
  const [editingId, setEditingId] = useState(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expandedCompanies, setExpandedCompanies] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef(null);
  const todayISO = getTodayISO();

  // Update stats when applications change
  useEffect(() => {
    setStats(generateStats(applications));
  }, [applications]);

  // Handle sorting
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Sort applications
  const sortedApplications = [...applications].sort((a, b) => {
    if (sortConfig.key === 'companyId') {
      const companyA = companies.find(c => c.id === a.companyId)?.name || '';
      const companyB = companies.find(c => c.id === b.companyId)?.name || '';
      return sortConfig.direction === 'asc' 
        ? companyA.localeCompare(companyB)
        : companyB.localeCompare(companyA);
    }
    
    if (a[sortConfig.key] < b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (a[sortConfig.key] > b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  // Filter applications based on search term
  const filteredApplications = sortedApplications.filter(app => {
    const company = companies.find(c => c.id === app.companyId)?.name || '';
    const searchString = `${company} ${app.role} ${app.status} ${app.notes}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  // Group applications by company
  const groupedApplications = filteredApplications.reduce((acc, app) => {
    const companyId = app.companyId;
    const companyName = companies.find(c => c.id === companyId)?.name || 'Unknown';
    
    if (!acc[companyId]) {
      acc[companyId] = {
        companyId,
        companyName,
        applications: []
      };
    }
    
    acc[companyId].applications.push(app);
    return acc;
  }, {});

  // Sort grouped applications
  const sortedGroupedApplications = Object.values(groupedApplications).sort((a: any, b: any) => {
    if (sortConfig.key === 'companyId') {
      return sortConfig.direction === 'asc'
        ? a.companyName.localeCompare(b.companyName)
        : b.companyName.localeCompare(a.companyName);
    }
    return 0;
  });

  // Toggle expand/collapse for a company
  const toggleCompanyExpand = (companyId) => {
    setExpandedCompanies(prev => ({
      ...prev,
      [companyId]: !prev[companyId]
    }));
  };

  // Expand all companies
  const expandAllCompanies = () => {
    const expanded = {};
    sortedGroupedApplications.forEach((group: any) => {
      expanded[group.companyId] = true;
    });
    setExpandedCompanies(expanded);
  };

  // Collapse all companies
  const collapseAllCompanies = () => {
    setExpandedCompanies({});
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewApplication(prev => ({ ...prev, [name]: value }));
    // clear error when user types
    setErrors(prev => ({ ...prev, [name]: "" }));
  };

  // Handle file upload
  const handleFileUpload = (e, fileType) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Store File objects and metadata; actual upload will happen on submit
    const newFiles = files.map(file => ({
      file,
      name: file.name,
      type: fileType,
      url: null // will be populated after upload
    }));

    setNewApplication(prev => ({
      ...prev,
      files: [...prev.files, ...newFiles]
    }));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    // simple validation
    const newErrors: Record<string, string> = {};
    if (!newApplication.companyId) newErrors.companyId = "Company is required";
    if (newApplication.companyId === "new" && !newApplication.newCompany.trim()) newErrors.newCompany = "Enter company name";
    if (!newApplication.role.trim()) newErrors.role = "Role is required";
    if (!newApplication.dateApplied) newErrors.dateApplied = "Date is required";
    else if (newApplication.dateApplied > todayISO) newErrors.dateApplied = "Future date not allowed";
    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }

    let companyId = parseInt(newApplication.companyId);

    // If new company is being added
    if (newApplication.companyId === "new" && newApplication.newCompany.trim()) {
      const newCompany = {
        id: companies.length + 1,
        name: newApplication.newCompany.trim()
      };
      setCompanies(prev => [...prev, newCompany]);
      companyId = newCompany.id;
    }

    // Build payload for API (don't include File objects; attachments upload happens after job is created/updated)
    const payload = {
      title: newApplication.role,
      company: companies.find(c => c.id === companyId)?.name || (newApplication.newCompany || null),
      status: newApplication.status,
      applied_date: newApplication.dateApplied,
      metadata: {
        notes: newApplication.notes || null,
        files: []
      }
    };

    // helper: create signed URL (server will call Vercel) and PUT file bytes, then persist metadata
    const uploadFileToServer = async (jobId, fileObj) => {
      // 1) request signed upload URL from server
      const createResp = await fetch('/api/uploads/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: fileObj.name, contentType: fileObj.file.type })
      });
      if (!createResp.ok) {
        throw new Error('failed to create upload URL');
      }
      const createBody = await createResp.json();

      const uploadUrl = createBody.uploadURL || createBody.uploadUrl || createBody.signedUrl || createBody.upload_url || createBody.url;
      const publicUrl = createBody.url || createBody.publicUrl || createBody.publicURL || null;
      const storageKey = createBody.key || createBody.storageKey || createBody.name || fileObj.name;

      if (!uploadUrl) {
        // Fallback: server returned a URL but no signed upload URL (e.g., provider not configured).
        // Use server-side upload endpoint which accepts base64 payload (`/api/uploads` expects contentBase64).
        const buf = await fileObj.file.arrayBuffer();
        const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        const metaResp = await fetch('/api/uploads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId, filename: fileObj.name, contentBase64: b64, contentType: fileObj.file.type })
        });
        if (!metaResp.ok) {
          const txt = await metaResp.text().catch(() => '<no body>');
          throw new Error(`server-side upload failed: ${metaResp.status} ${txt}`);
        }
        return await metaResp.json();
      }

      // 2) PUT the file bytes directly to the signed URL
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': fileObj.file.type },
        body: fileObj.file
      });
      if (!putRes.ok) {
        const text = await putRes.text().catch(()=>'<no body>');
        throw new Error(`upload failed during PUT: ${putRes.status} ${text}`);
      }

      // 3) persist attachment metadata by posting to /api/uploads (metadata mode)
      const metaResp = await fetch('/api/uploads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, filename: fileObj.name, url: publicUrl || uploadUrl, storageKey, size: fileObj.file.size, contentType: fileObj.file.type })
      });
      if (!metaResp.ok) throw new Error('failed to persist attachment metadata');
      return await metaResp.json();
    };

    try {
      if (editingId) {
        // Update existing application on server
        const resp = await fetch(`/api/jobs/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!resp.ok) throw new Error('Failed to update');
        const updated = await resp.json();
        // After updating job, upload any new files and attach them
        const filesToUpload = newApplication.files.filter(f => f && f.file);
        let attachments = [];
        if (filesToUpload.length) {
          attachments = await Promise.all(filesToUpload.map(f => uploadFileToServer(updated.id, f)));
          // Map attachments into metadata.files shape
          const attachMeta = attachments.map(a => ({ name: a.filename, url: a.url, id: a.id }));
          // patch job metadata to include attachments
          await fetch(`/api/jobs/${updated.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ metadata: { ...updated.metadata, files: attachMeta } })
          });
          updated.metadata = { ...updated.metadata, files: attachMeta };
        }

        setApplications(applications.map(app => app.id === editingId ? {
          ...app,
          companyId,
          role: updated.title,
              dateApplied: normalizeDateToInput(updated.applied_date),
          status: updated.status,
          notes: updated.metadata?.notes || '',
          files: updated.metadata?.files || []
        } : app));
        setEditingId(null);
      } else {
        // Create new job on server
        const resp = await fetch('/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!resp.ok) throw new Error('Failed to create');
        const created = await resp.json();
        // Upload files (if any) and attach to created job
        const filesToUpload = newApplication.files.filter(f => f && f.file);
        let attachments = [];
        if (filesToUpload.length) {
          attachments = await Promise.all(filesToUpload.map(f => uploadFileToServer(created.id, f)));
          const attachMeta = attachments.map(a => ({ name: a.filename, url: a.url, id: a.id }));
          // update job metadata with uploaded files
          await fetch(`/api/jobs/${created.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ metadata: { ...(created.metadata || {}), files: attachMeta } })
          });
          created.metadata = { ...(created.metadata || {}), files: attachMeta };
        }

        const newApp = {
          id: created.id,
          companyId,
          role: created.title,
          dateApplied: normalizeDateToInput(created.applied_date),
          status: created.status,
          notes: created.metadata?.notes || '',
          files: created.metadata?.files || []
        };

        setApplications(prev => [...prev, newApp]);

        // Auto-expand the company group when adding a new application
        setExpandedCompanies(prev => ({
          ...prev,
          [companyId]: true
        }));
      }

      // Reset form
      setNewApplication({
        companyId: "",
        newCompany: "",
        role: "",
        dateApplied: getTodayISO(),
        status: "Applied",
        notes: "",
        files: []
      });
      setCompanyQuery('');
      setCompanyDropdownOpen(false);
      setShowAddForm(false);
    } catch (err) {
      logger.error(err);
      alert('Failed to save application. See console for details.');
    }
  };

  // Handle edit application
  const handleEdit = (id) => {
    const app = applications.find(a => a.id === id);
    if (!app) return;
    const companyName = getCompanyName(app.companyId);
    
    setNewApplication({
      companyId: app.companyId.toString(),
      newCompany: "",
      role: app.role,
      dateApplied: normalizeDateToInput(app.dateApplied),
      status: app.status,
      notes: app.notes,
      files: app.files
    });
    // prefill combo input
    setCompanyQuery(companyName);
    
    setEditingId(id);
    setShowAddForm(true);
  };

  // Handle delete application (open confirmation)
  const handleDelete = (id) => {
    const app = applications.find(a => a.id === id);
    if (!app) return;
    setDeleteTarget(app);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/jobs/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Delete failed: ${res.status} ${txt}`);
      }
      setApplications(prev => prev.filter(a => a.id !== deleteTarget.id));
      setDeleteTarget(null);
      setConfirmOpen(false);
    } catch (err) {
      logger.error('delete failed', err && err.message);
      alert('Failed to delete application. See console for details.');
    }
  };

  const cancelDelete = () => {
    setDeleteTarget(null);
    setConfirmOpen(false);
  };

  // Handle export to Excel
  const handleExport = () => {
    // In a real app, you would generate an Excel file
    // For this mock, we'll just show an alert
    alert("In a real application, this would download an Excel file with all your job application data.");
  };

  // Get company name by ID
  const getCompanyName = (id) => {
    return companies.find(c => c.id === id)?.name || 'Unknown';
  };

  // Remove file from application
  const removeFile = (fileName) => {
    setNewApplication(prev => ({
      ...prev,
      files: prev.files.filter(file => file.name !== fileName)
    }));
  };

  return (
    <div className="min-h-screen bg-white text-black flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-md py-4 px-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Job Application Tracker</h1>
          <nav className="hidden md:flex space-x-4">
            <button 
              onClick={() => setActiveTab("dashboard")}
              className={`px-3 py-2 rounded-md ${activeTab === "dashboard" ? "bg-blue-600 text-white" : "hover:bg-gray-100"}`}
            >
              Dashboard
            </button>
            <button 
              onClick={() => setActiveTab("applications")}
              className={`px-3 py-2 rounded-md ${activeTab === "applications" ? "bg-blue-600 text-white" : "hover:bg-gray-100"}`}
            >
              Applications
            </button>
          </nav>
          <div className="md:hidden">
            <select 
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
              className="border rounded-md px-2 py-1"
            >
              <option value="dashboard">Dashboard</option>
              <option value="applications">Applications</option>
            </select>
          </div>
        </div>
      </header>
      {/* Delete confirmation modal (portal) */}
      <SimpleModal open={confirmOpen} onClose={cancelDelete} titleId="modal-title" descriptionId="modal-desc">
        <div className="flex justify-between items-start">
          <div>
            <h3 id="modal-title" className="text-lg font-semibold">Delete application</h3>
            <p id="modal-desc" className="text-sm text-gray-600">Are you sure you want to delete this application? This will remove the job record and its attached files from storage.</p>
          </div>
          <button onClick={cancelDelete} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="mt-4">
          {deleteTarget && (
            <div>
              <p className="font-medium">{getCompanyName(deleteTarget.companyId)} — {deleteTarget.role}</p>
              <p className="text-sm text-gray-500">Date Applied: {formatDisplayDate(deleteTarget.dateApplied)}</p>
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-end items-center gap-3">
          <button
            onClick={confirmDelete}
            className="px-4 py-2 rounded text-white"
            style={{ backgroundColor: '#dc2626', marginRight: '12px' }}
            aria-label="Confirm delete"
          >
            Delete
          </button>
          <button className="px-4 py-2 rounded border bg-white" onClick={cancelDelete}>Cancel</button>
        </div>
      </SimpleModal>

      {/* Main content */}
      <main className="flex-grow p-6">
        <div className="max-w-7xl mx-auto">
          {/* Dashboard */}
          {activeTab === "dashboard" && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold">Application Statistics</h2>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => setSelectedTimeframe("daily")}
                      className={`px-3 py-1 text-sm rounded-md ${selectedTimeframe === "daily" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
                    >
                      Daily
                    </button>
                    <button 
                      onClick={() => setSelectedTimeframe("weekly")}
                      className={`px-3 py-1 text-sm rounded-md ${selectedTimeframe === "weekly" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
                    >
                      Weekly
                    </button>
                    <button 
                      onClick={() => setSelectedTimeframe("monthly")}
                      className={`px-3 py-1 text-sm rounded-md ${selectedTimeframe === "monthly" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
                    >
                      Monthly
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h3 className="text-lg font-medium mb-2">Total Applications</h3>
                    <p className="text-3xl font-bold">{stats.total}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <h3 className="text-lg font-medium mb-2">Applications This Week</h3>
                    <p className="text-3xl font-bold">{stats.weekly[3].count}</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <h3 className="text-lg font-medium mb-2">Applications This Month</h3>
                    <p className="text-3xl font-bold">{stats.monthly[5].count}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <h3 className="text-lg font-medium mb-4">Applications Over Time</h3>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={selectedTimeframe === "daily" ? stats.daily : 
                                selectedTimeframe === "weekly" ? stats.weekly : stats.monthly}
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey={selectedTimeframe === "daily" ? "date" : 
                                    selectedTimeframe === "weekly" ? "week" : "month"} 
                          />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="count">
                            {(selectedTimeframe === "daily" ? stats.daily : selectedTimeframe === "weekly" ? stats.weekly : stats.monthly).map((entry, idx) => (
                              <Cell key={`bar-${idx}`} fill={COLORS[idx % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium mb-4">Application Status</h3>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={stats.status}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          >
                            {stats.status.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold">Recent Applications</h2>
                  <button 
                    onClick={() => setActiveTab("applications")}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    View All
                  </button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Applied</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sortedApplications.slice(0, 5).map((app) => (
                        <tr key={app.id}>
                          <td className="px-6 py-4 whitespace-nowrap">{getCompanyName(app.companyId)}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{app.role}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{formatDisplayDate(app.dateApplied)}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                              ${app.status === 'Applied' ? 'bg-yellow-100 text-yellow-800' : 
                                app.status === 'Interview' ? 'bg-blue-100 text-blue-800' : 
                                app.status === 'Offer' ? 'bg-green-100 text-green-800' : 
                                app.status === 'Rejected' ? 'bg-red-100 text-red-800' : 
                                'bg-gray-100 text-gray-800'}`}>
                              {app.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* Applications */}
          {activeTab === "applications" && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 space-y-4 md:space-y-0">
                  <h2 className="text-xl font-semibold">Job Applications</h2>
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search applications..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border rounded-md w-full sm:w-64"
                      />
                      <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                    </div>
                    <button 
                      onClick={() => { setShowAddForm(true); setCompanyQuery(''); setEditingId(null); }}
                      className="flex items-center justify-center space-x-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                    >
                      <Plus className="h-5 w-5" />
                      <span>Add Application</span>
                    </button>
                    <button 
                      onClick={handleExport}
                      className="flex items-center justify-center space-x-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                    >
                      <FileSpreadsheet className="h-5 w-5" />
                      <span>Export</span>
                    </button>
                  </div>
                </div>
                
                <div className="mb-4 flex justify-end">
                  <div className="flex space-x-2">
                    <button 
                      onClick={expandAllCompanies}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Expand All
                    </button>
                    <span className="text-gray-300">|</span>
                    <button 
                      onClick={collapseAllCompanies}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Collapse All
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="w-8 px-2 py-3"></th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                          onClick={() => handleSort('companyId')}
                        >
                          <div className="flex items-center space-x-1">
                            <span>Company</span>
                            {sortConfig.key === 'companyId' && (
                              sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                            )}
                          </div>
                        </th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                          onClick={() => handleSort('role')}
                        >
                          <div className="flex items-center space-x-1">
                            <span>Role</span>
                            {sortConfig.key === 'role' && (
                              sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                            )}
                          </div>
                        </th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                          onClick={() => handleSort('dateApplied')}
                        >
                          <div className="flex items-center space-x-1">
                            <span>Date Applied</span>
                            {sortConfig.key === 'dateApplied' && (
                              sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                            )}
                          </div>
                        </th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                          onClick={() => handleSort('status')}
                        >
                          <div className="flex items-center space-x-1">
                            <span>Status</span>
                            {sortConfig.key === 'status' && (
                              sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                            )}
                          </div>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Files</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sortedGroupedApplications.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                            No applications found. Add your first application!
                          </td>
                        </tr>
                      ) : (
                        sortedGroupedApplications.map((group: any) => (
                          <React.Fragment key={group.companyId}>
                            {/* Company Row */}
                            <tr 
                              className="bg-gray-50 hover:bg-gray-100 cursor-pointer"
                              onClick={() => toggleCompanyExpand(group.companyId)}
                            >
                              <td className="px-2 py-3 text-center">
                                {expandedCompanies[group.companyId] ? (
                                  <ChevronDown className="h-4 w-4 text-gray-500" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-gray-500" />
                                )}
                              </td>
                              <td className="px-6 py-3 font-medium">
                                {group.companyName}
                                <span className="ml-2 text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                                  {group.applications.length} role{group.applications.length !== 1 ? 's' : ''}
                                </span>
                              </td>
                              <td colSpan={5} className="px-6 py-3 text-sm text-gray-500 text-right">
                                Click to {expandedCompanies[group.companyId] ? 'collapse' : 'expand'}
                              </td>
                            </tr>
                            
                            {/* Application Rows */}
                            {expandedCompanies[group.companyId] && 
                              group.applications.map(app => (
                                <tr key={app.id} className="hover:bg-gray-50">
                                  <td className="px-2 py-3"></td>
                                  <td className="px-6 py-3 pl-10">
                                    <span className="text-gray-400">{group.companyName}</span>
                                  </td>
                                  <td className="px-6 py-3">{app.role}</td>
                                  <td className="px-6 py-3">{formatDisplayDate(app.dateApplied)}</td>
                                  <td className="px-6 py-3">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                      ${app.status === 'Applied' ? 'bg-yellow-100 text-yellow-800' : 
                                        app.status === 'Interview' ? 'bg-blue-100 text-blue-800' : 
                                        app.status === 'Offer' ? 'bg-green-100 text-green-800' : 
                                        app.status === 'Rejected' ? 'bg-red-100 text-red-800' : 
                                        'bg-gray-100 text-gray-800'}`}>
                                      {app.status}
                                    </span>
                                  </td>
                                  <td className="px-6 py-3">
                                    <div className="flex space-x-1">
                                      {app.files.map((file, index) => (
                                        <span 
                                          key={index}
                                          className="px-2 py-1 bg-gray-100 text-xs rounded-md flex items-center"
                                          title={file.name}
                                        >
                                          <FileText className="h-3 w-3 mr-1" />
                                          {file.type === 'resume' ? 'CV' : 
                                           file.type === 'coverLetter' ? 'CL' : 
                                           file.type === 'jobDescription' ? 'JD' : file.type === 'applicationDoc' ? 'App' : 'Doc'}
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="px-6 py-3 text-sm font-medium">
                                    <div className="flex space-x-2">
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEdit(app.id);
                                        }}
                                        className="text-blue-600 hover:text-blue-900"
                                      >
                                        <Edit className="h-5 w-5" />
                                      </button>
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDelete(app.id);
                                        }}
                                        className="text-red-600 hover:text-red-900"
                                      >
                                        <Trash2 className="h-5 w-5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            }
                          </React.Fragment>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
          
          {/* Add/Edit Application Form Modal */}
          {showAddForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold">{editingId ? "Edit Application" : "Add New Application"}</h2>
                    <button 
                      onClick={() => {
                        setShowAddForm(false);
                        setEditingId(null);
                        setNewApplication({
                          companyId: "",
                          newCompany: "",
                          role: "",
                          dateApplied: getTodayISO(),
                          status: "Applied",
                          notes: "",
                          files: []
                        });
                        setCompanyQuery('');
                        setCompanyDropdownOpen(false);
                      }}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X className="h-6 w-6" />
                    </button>
                  </div>
                  
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                      <div>
                        <input
                          type="text"
                          name="companyQuery"
                          value={companyQuery}
                          onChange={(e) => {
                            setCompanyQuery(e.target.value);
                            setCompanyDropdownOpen(true);
                            // clear selection while typing
                            setNewApplication(prev => ({ ...prev, companyId: '' }));
                          }}
                          onFocus={() => setCompanyDropdownOpen(true)}
                          placeholder="Type to search or add a company"
                          className={`w-full border rounded-md px-3 py-2 ${errors.companyId ? 'border-red-500' : ''}`}
                          aria-required="true"
                        />
                      </div>

                      {companyDropdownOpen && (
                        <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg max-h-56 overflow-auto">
                          <button
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); /* prevent blur */ }}
                            onClick={() => {
                              // choose add new company
                              setNewApplication(prev => ({ ...prev, companyId: 'new' }));
                              setCompanyQuery('');
                              setCompanyDropdownOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-100"
                          >
                            + Add new company
                          </button>

                          {companies.filter(c => c.name.toLowerCase().includes(companyQuery.toLowerCase())).map(c => (
                            <button
                              key={c.id}
                              type="button"
                              onMouseDown={(e) => { e.preventDefault(); }}
                              onClick={() => {
                                setNewApplication(prev => ({ ...prev, companyId: c.id.toString(), newCompany: '' }));
                                setCompanyQuery(c.name);
                                setCompanyDropdownOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-100"
                            >
                              {c.name}
                            </button>
                          ))}

                          {companies.filter(c => c.name.toLowerCase().includes(companyQuery.toLowerCase())).length === 0 && (
                            <div className="px-3 py-2 text-gray-500">No matching companies</div>
                          )}
                        </div>
                      )}

                      {errors.companyId && <p className="text-red-500 text-xs mt-1">{errors.companyId}</p>}
                    </div>
                    
                    {newApplication.companyId === "new" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">New Company Name</label>
                        <input
                          type="text"
                          name="newCompany"
                          placeholder="Enter company name *"
                          value={newApplication.newCompany}
                          onChange={handleInputChange}
                          className={`w-full border rounded-md px-3 py-2 ${errors.newCompany ? 'border-red-500' : ''}`}
                          aria-required="true"
                        />
                        {errors.newCompany && <p className="text-red-500 text-xs mt-1">{errors.newCompany}</p>}
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                      <input
                        type="text"
                        name="role"
                        placeholder="e.g., Frontend Engineer *"
                        value={newApplication.role}
                        onChange={handleInputChange}
                        className={`w-full border rounded-md px-3 py-2 ${errors.role ? 'border-red-500' : ''}`}
                        aria-required="true"
                      />
                      {errors.role && <p className="text-red-500 text-xs mt-1">{errors.role}</p>}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date Applied</label>
                      <input
                        type="date"
                        name="dateApplied"
                        max={todayISO}
                        value={newApplication.dateApplied}
                        onChange={handleInputChange}
                        className={`w-full border rounded-md px-3 py-2 ${errors.dateApplied ? 'border-red-500' : ''}`}
                        aria-required="true"
                      />
                      {errors.dateApplied && <p className="text-red-500 text-xs mt-1">{errors.dateApplied}</p>}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        name="status"
                        value={newApplication.status}
                        onChange={handleInputChange}
                        className="w-full border rounded-md px-3 py-2"
                        required
                      >
                        {statusOptions.map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                      <textarea
                        name="notes"
                        placeholder="e.g., applied via LinkedIn"
                        value={newApplication.notes}
                        onChange={handleInputChange}
                        className="w-full border rounded-md px-3 py-2 h-24"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Files</label>
                      <div className="space-y-2">
                        {newApplication.files.map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded-md">
                            <div className="flex items-center">
                              <FileText className="h-4 w-4 mr-2 text-gray-500" />
                              <span className="text-sm">{file.name}</span>
                            </div>
                            <button 
                              type="button"
                              onClick={() => removeFile(file.name)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                          <div>
                            <input
                              type="file"
                              ref={fileInputRef}
                              className="hidden"
                              onChange={(e) => handleFileUpload(e, 'resume')}
                            />
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="w-full flex items-center justify-center space-x-1 bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded-md text-sm"
                            >
                              <Upload className="h-4 w-4" />
                              <span>Upload Resume</span>
                            </button>
                          </div>
                          <div>
                            <input
                              type="file"
                              className="hidden"
                              onChange={(e) => handleFileUpload(e, 'coverLetter')}
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                const el = (e.currentTarget.previousSibling as HTMLInputElement)
                                el?.click()
                              }}
                              className="w-full flex items-center justify-center space-x-1 bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded-md text-sm"
                            >
                              <Upload className="h-4 w-4" />
                              <span>Upload Cover Letter</span>
                            </button>
                          </div>
                          <div>
                            <input
                              type="file"
                              className="hidden"
                              onChange={(e) => handleFileUpload(e, 'jobDescription')}
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                const el = (e.currentTarget.previousSibling as HTMLInputElement)
                                el?.click()
                              }}
                              className="w-full flex items-center justify-center space-x-1 bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded-md text-sm"
                            >
                              <Upload className="h-4 w-4" />
                              <span>Upload Job Description</span>
                            </button>
                          </div>
                          <div>
                            <input
                              type="file"
                              className="hidden"
                              onChange={(e) => handleFileUpload(e, 'applicationDoc')}
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                const el = (e.currentTarget.previousSibling as HTMLInputElement)
                                el?.click()
                              }}
                              className="w-full flex items-center justify-center space-x-1 bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded-md text-sm"
                            >
                              <Upload className="h-4 w-4" />
                              <span>Upload Application Doc</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-end space-x-2 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddForm(false);
                          setEditingId(null);
                          setCompanyQuery('');
                          setCompanyDropdownOpen(false);
                        }}
                        className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        {editingId ? "Update" : "Save"}
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t py-4 px-6">
        <div className="max-w-7xl mx-auto text-center text-gray-500 text-sm">
          <p>Job Application Tracker &copy; {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
// Figma integration removed — no-op. If you previously relied on
// `figma:react` for plugin metadata, reintroduce it in a separate
// plugin-specific build. The web app does not need Figma runtime calls.