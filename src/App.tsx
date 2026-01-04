import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import SimpleModal from './components/SimpleModal';
import { normalizeDateToInput, getTodayISO } from './utils/date';
import logger from './utils/logger';
import { motion } from "motion/react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Upload, Plus, Search, Calendar, FileText, ChevronDown, ChevronUp, X, Edit, Trash2, FileSpreadsheet, ChevronRight, Eye } from "lucide-react";
import * as XLSX from 'xlsx';

// Helper to format dates in DD-MMM-YYYY, e.g., 05-May-2024
// Parse YYYY-MM-DD strings as local dates to ensure list view matches the date input and DB values
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

// Initial empty arrays — real data will be loaded from the API on mount
const initialCompanies: Array<{ id: number; name: string }> = [];
const initialApplications: Array<any> = [];

// Status options
const statusOptions = ["Applied", "Interview", "Offer", "Rejected", "Withdrawn"];

// Colors for charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

// Function to generate statistics based on date range and timeframe
const generateStats = (applications, startDate?: string, endDate?: string, timeframe: string = 'daily') => {
  // Filter applications by date range if provided
  const filteredApps = (startDate && endDate) 
    ? applications.filter(app => {
        const appDate = app.dateApplied;
        return appDate >= startDate && appDate <= endDate;
      })
    : applications;

  const start = startDate ? new Date(startDate + 'T00:00:00') : new Date();
  const end = endDate ? new Date(endDate + 'T23:59:59') : new Date();
  
  // Daily stats - each day in the range
  const dailyStats = [];
  if (startDate && endDate) {
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dateString = currentDate.toISOString().split('T')[0];
      const count = filteredApps.filter(app => app.dateApplied === dateString).length;
      dailyStats.push({
        date: formatDisplayDate(currentDate.toISOString()),
        count
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }
  } else {
    // Default: last 7 days
    const now = new Date();
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
  }
  
  // Monthly stats - group by month in the range
  const monthlyStats = [];
  if (startDate && endDate) {
    const currentMonth = new Date(start.getFullYear(), start.getMonth(), 1);
    while (currentMonth <= end) {
      const monthStart = new Date(currentMonth);
      const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      
      const count = filteredApps.filter(app => {
        const appDate = new Date(app.dateApplied);
        return appDate >= monthStart && appDate <= monthEnd;
      }).length;
      
      monthlyStats.push({
        month: currentMonth.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        count
      });
      
      currentMonth.setMonth(currentMonth.getMonth() + 1);
    }
  } else {
    // Default: last 6 months
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      const count = applications.filter(app => {
        const appDate = new Date(app.dateApplied);
        return appDate >= monthStart && appDate <= monthEnd;
      }).length;
      
      monthlyStats.push({
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        count
      });
    }
  }
  
  // Yearly stats - group by year in the range
  const yearlyStats = [];
  if (startDate && endDate) {
    for (let year = start.getFullYear(); year <= end.getFullYear(); year++) {
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year, 11, 31);
      
      const count = filteredApps.filter(app => {
        const appDate = new Date(app.dateApplied);
        return appDate >= yearStart && appDate <= yearEnd;
      }).length;
      
      yearlyStats.push({
        year: year.toString(),
        count
      });
    }
  } else {
    // Default: last 5 years
    const now = new Date();
    for (let i = 4; i >= 0; i--) {
      const year = now.getFullYear() - i;
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year, 11, 31);
      
      const count = applications.filter(app => {
        const appDate = new Date(app.dateApplied);
        return appDate >= yearStart && appDate <= yearEnd;
      }).length;
      
      yearlyStats.push({
        year: year.toString(),
        count
      });
    }
  }
  
  // Status distribution - based on filtered applications
  const statusStats = statusOptions.map(status => ({
    name: status,
    value: filteredApps.filter(app => app.status === status).length
  }));
  
  return {
    daily: dailyStats,
    monthly: monthlyStats,
    yearly: yearlyStats,
    status: statusStats,
    total: filteredApps.length
  };
};

// Main component
export default function App() {
  // State
  const [activeTab, setActiveTab] = useState("dashboard");
  const [companies, setCompanies] = useState(initialCompanies);
  const [applications, setApplications] = useState(initialApplications);
  const [selectedTimeframe, setSelectedTimeframe] = useState("daily");
  
  // Date range filter state
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [dateRangeError, setDateRangeError] = useState("");
  
  // Get max allowed range based on timeframe
  const getMaxRangeDays = (timeframe: string) => {
    switch (timeframe) {
      case 'daily': return 30;
      case 'monthly': return 365; // 12 months
      case 'yearly': return 3650; // 10 years
      default: return 30;
    }
  };
  
  // Validate and adjust date range when timeframe changes
  const validateDateRange = (start: string, end: string, timeframe: string): { valid: boolean; error: string } => {
    if (!start || !end) return { valid: true, error: '' };
    
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const maxDays = getMaxRangeDays(timeframe);
    
    if (startDate > endDate) {
      return { valid: false, error: 'Start date must be before end date' };
    }
    
    if (diffDays > maxDays) {
      const limits = {
        daily: '30 days',
        monthly: '12 months',
        yearly: '10 years'
      };
      return { valid: false, error: `Max range for ${timeframe} view is ${limits[timeframe]}` };
    }
    
    return { valid: true, error: '' };
  };
  
  // Handle timeframe change
  const handleTimeframeChange = (newTimeframe: string) => {
    setSelectedTimeframe(newTimeframe);
    const validation = validateDateRange(filterStartDate, filterEndDate, newTimeframe);
    setDateRangeError(validation.error);
  };
  
  // Handle date change
  const handleDateRangeChange = (type: 'start' | 'end', value: string) => {
    const newStart = type === 'start' ? value : filterStartDate;
    const newEnd = type === 'end' ? value : filterEndDate;
    
    if (type === 'start') setFilterStartDate(value);
    else setFilterEndDate(value);
    
    const validation = validateDateRange(newStart, newEnd, selectedTimeframe);
    setDateRangeError(validation.error);
  };
  
  // Handle year change for yearly timeframe
  const handleYearChange = (type: 'start' | 'end', year: string) => {
    const value = type === 'start' ? `${year}-01-01` : `${year}-12-31`;
    handleDateRangeChange(type, value);
  };
  
  // Get year from date string
  const getYearFromDate = (dateStr: string) => {
    if (!dateStr) return '';
    return dateStr.split('-')[0];
  };
  
  // Generate year options (last 20 years to current year)
  const yearOptionsDesc = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentYear; y >= currentYear - 20; y--) {
      years.push(y);
    }
    return years;
  }, []);
  
  // Ascending order for start year
  const yearOptionsAsc = useMemo(() => [...yearOptionsDesc].reverse(), [yearOptionsDesc]);
  
  // Generate month-year options (last 24 months)
  const monthYearOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      options.push({ value, label });
    }
    return options;
  }, []);
  
  // Ascending order for start month
  const monthYearOptionsAsc = useMemo(() => [...monthYearOptions].reverse(), [monthYearOptions]);
  
  // Handle month-year change for monthly timeframe
  const handleMonthYearChange = (type: 'start' | 'end', value: string) => {
    if (!value) {
      handleDateRangeChange(type, '');
      return;
    }
    const [year, month] = value.split('-').map(Number);
    if (type === 'start') {
      handleDateRangeChange(type, `${year}-${String(month).padStart(2, '0')}-01`);
    } else {
      // Get last day of month
      const lastDay = new Date(year, month, 0).getDate();
      handleDateRangeChange(type, `${year}-${String(month).padStart(2, '0')}-${lastDay}`);
    }
  };
  
  // Get month-year from date string (YYYY-MM)
  const getMonthYearFromDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length >= 2) {
      return `${parts[0]}-${parts[1]}`;
    }
    return '';
  };
  
  // Clear date range filter
  const clearDateRange = () => {
    setFilterStartDate('');
    setFilterEndDate('');
    setDateRangeError('');
  };
  
  // Compute stats with date range filter
  const stats = useMemo(() => {
    const hasDateSelection = filterStartDate || filterEndDate;
    const hasValidRange = filterStartDate && filterEndDate && !dateRangeError;
    
    // If user has selected dates but there's an error, return empty stats
    if (hasDateSelection && dateRangeError) {
      return {
        daily: [],
        monthly: [],
        yearly: [],
        status: statusOptions.map(status => ({ name: status, value: 0 })),
        total: 0
      };
    }
    
    return generateStats(
      applications, 
      hasValidRange ? filterStartDate : undefined, 
      hasValidRange ? filterEndDate : undefined,
      selectedTimeframe
    );
  }, [applications, filterStartDate, filterEndDate, dateRangeError, selectedTimeframe]);
  
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

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
            files: r.metadata?.files || [],
            statusNotes: r.status_notes || ''
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
  const [sortConfig, setSortConfig] = useState({ key: 'companyId', direction: 'asc' });
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [viewingId, setViewingId] = useState(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expandedCompanies, setExpandedCompanies] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const todayISO = getTodayISO();
  
  // Map of companyId -> companyName for fast lookup (avoid repeated .find calls)
  const companyMap = useMemo(() => {
    const m = new Map<number, string>();
    companies.forEach(c => m.set(c.id, c.name));
    return m;
  }, [companies]);

  // Handle sorting
  const handleSort = useCallback((key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  // Sort applications - memoized for performance
  const sortedApplications = useMemo(() => [...applications].sort((a, b) => {
    if (sortConfig.key === 'companyId') {
      const companyA = companyMap.get(a.companyId) || '';
      const companyB = companyMap.get(b.companyId) || '';
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
  }), [applications, sortConfig, companies]);


  // Filter applications based on search term - respects `sortedApplications` ordering
  const filteredApplications = useMemo(() => sortedApplications.filter(app => {
    const company = companyMap.get(app.companyId) || '';
    const searchString = `${company} ${app.role} ${app.status} ${app.notes}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  }), [sortedApplications, companies, searchTerm]);

  // Group applications by company - memoized
  const groupedApplications = useMemo(() => filteredApplications.reduce((acc, app) => {
    const companyId = app.companyId;
    const companyName = companyMap.get(companyId) || 'Unknown';
    
    if (!acc[companyId]) {
      acc[companyId] = {
        companyId,
        companyName,
        applications: []
      };
    }
    
    acc[companyId].applications.push(app);
    return acc;
  }, {} as Record<number, any>), [filteredApplications, companies]);

  // Sort grouped applications - memoized
  const sortedGroupedApplications = useMemo(() => Object.values(groupedApplications).sort((a: any, b: any) => {
    if (sortConfig.key === 'companyId') {
      return sortConfig.direction === 'asc'
        ? a.companyName.localeCompare(b.companyName)
        : b.companyName.localeCompare(a.companyName);
    }
    return 0;
  }), [groupedApplications, sortConfig]);

  // Toggle expand/collapse for a company
  const toggleCompanyExpand = useCallback((companyId) => {
    setExpandedCompanies(prev => ({
      ...prev,
      [companyId]: !prev[companyId]
    }));
  }, []);

  // Expand all companies
  const expandAllCompanies = useCallback(() => {
    const expanded = {};
    sortedGroupedApplications.forEach((group: any) => {
      expanded[group.companyId] = true;
    });
    setExpandedCompanies(expanded);
  }, [sortedGroupedApplications]);

  // Collapse all companies
  const collapseAllCompanies = useCallback(() => {
    setExpandedCompanies({});
  }, []);

  // Handle form input changes
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setNewApplication(prev => ({ ...prev, [name]: value }));
    // clear error when user types
    setErrors(prev => ({ ...prev, [name]: "" }));
  }, []);

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

    setIsSaving(true);

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
      company: companyMap.get(companyId) || (newApplication.newCompany || null),
      status: newApplication.status,
      applied_date: newApplication.dateApplied,
      metadata: {
        notes: newApplication.notes || null,
        files: []
      }
    };

    // helper: create signed URL (server will call Vercel) and PUT file bytes, then persist metadata
    const uploadFileToServer = async (jobId, fileObj) => {
      // Safe ArrayBuffer -> base64 conversion (avoid spread operator which can exceed call stack)
      function arrayBufferToBase64(buffer: ArrayBuffer) {
        const bytes = new Uint8Array(buffer);
        const chunkSize = 0x8000; // 32KB chunks
        let binary = '';
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, i + chunkSize);
          binary += String.fromCharCode.apply(null, Array.prototype.slice.call(chunk));
        }
        return btoa(binary);
      }
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
        const b64 = arrayBufferToBase64(buf);
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

      // If the signed upload URL is cross-origin, some providers block browser PUTs
      // due to CORS preflight restrictions. In that case, perform the PUT server-side
      // by sending the bytes to `/api/uploads` with `uploadUrl` and let the server
      // execute the PUT. This avoids CORS issues for providers that don't allow
      // browser-side uploads.
      let usedUploadUrl = uploadUrl;
      let uploadedViaServer = false;
      try {
        const uploadOrigin = uploadUrl ? new URL(uploadUrl).origin : null;
        if (uploadOrigin && uploadOrigin !== window.location.origin) {
          // server-side upload
          const buf = await fileObj.file.arrayBuffer();
          const b64 = arrayBufferToBase64(buf);
          const metaResp = await fetch('/api/uploads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId, filename: fileObj.name, contentBase64: b64, contentType: fileObj.file.type, uploadUrl })
          });
          if (!metaResp.ok) {
            const txt = await metaResp.text().catch(() => '<no body>');
            // Surface server-side upload failure instead of falling back to a browser PUT
            throw new Error(`server-side upload failed: ${metaResp.status} ${txt}`);
          }
          const savedMeta = await metaResp.json();
          uploadedViaServer = true;
          return savedMeta;
        }
      } catch (e) {
        // Do not fall back to cross-origin browser PUT when server-side upload fails —
        // that will trigger CORS errors. Instead, surface the server error.
        throw e;
      }

      // 2) PUT the file bytes directly to the signed URL (browser)
      const putRes = await fetch(usedUploadUrl, {
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
          files: updated.metadata?.files || [],
          statusNotes: updated.status_notes || ''
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
          files: created.metadata?.files || [],
          statusNotes: created.status_notes || ''
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
      setIsSaving(false);
    } catch (err) {
      setIsSaving(false);
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
      files: app.files,
      statusNotes: app.statusNotes || ''
    });
    // prefill combo input
    setCompanyQuery(companyName);
    
    setEditingId(id);
    setShowAddForm(true);
  };

  // Handle view (read-only) application
  const handleView = (id) => {
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
      files: app.files,
      statusNotes: app.statusNotes || ''
    });
    setCompanyQuery(companyName);

    setViewingId(id);
    setEditingId(null);
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

  // Get company name by ID - memoized for use in export
  const getCompanyName = useCallback((id) => {
    return companyMap.get(id) || 'Unknown';
  }, [companyMap]);

  // Handle export to Excel
  const handleExport = useCallback(() => {
    // Prepare data for export - use filtered/searched applications
    const exportData = filteredApplications.map(app => {
      const companyName = getCompanyName(app.companyId);
      
      return {
        'Company': companyName,
        'Role': app.role,
        'Date Applied': formatDisplayDate(app.dateApplied),
        'Status': app.status,
        'Notes': app.notes || '',
        'Status History': app.statusNotes || ''
      };
    });
    
    if (exportData.length === 0) {
      alert('No applications to export.');
      return;
    }
    
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // Set column widths for better readability
    const colWidths = [
      { wch: 25 },  // Company
      { wch: 30 },  // Role
      { wch: 15 },  // Date Applied
      { wch: 12 },  // Status
      { wch: 50 },  // Notes
      { wch: 50 }   // Status Notes
    ];
    ws['!cols'] = colWidths;
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Job Applications');
    
    // Generate filename with current date
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const filename = `job_applications_${dateStr}.xlsx`;
    
    // Download the file
    XLSX.writeFile(wb, filename);
  }, [filteredApplications, getCompanyName]);

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
              className={`px-3 py-2 rounded-md cursor-pointer ${activeTab === "dashboard" ? "bg-blue-600 text-white" : "hover:bg-gray-100"}`}
            >
              Dashboard
            </button>
            <button 
              onClick={() => setActiveTab("applications")}
              className={`px-3 py-2 rounded-md cursor-pointer ${activeTab === "applications" ? "bg-blue-600 text-white" : "hover:bg-gray-100"}`}
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
            className="px-4 py-2 rounded text-white cursor-pointer"
            style={{ backgroundColor: '#dc2626', marginRight: '12px' }}
            aria-label="Confirm delete"
          >
            Delete
          </button>
          <button className="px-4 py-2 rounded border bg-white cursor-pointer" onClick={cancelDelete}>Cancel</button>
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
                <div className="flex flex-col space-y-4 mb-6">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold">Application Statistics</h2>
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => handleTimeframeChange("daily")}
                        className={`px-3 py-1 text-sm rounded-md cursor-pointer ${selectedTimeframe === "daily" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
                      >
                        Daily
                      </button>
                      <button 
                        onClick={() => handleTimeframeChange("monthly")}
                        className={`px-3 py-1 text-sm rounded-md cursor-pointer ${selectedTimeframe === "monthly" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
                      >
                        Monthly
                      </button>
                      <button 
                        onClick={() => handleTimeframeChange("yearly")}
                        className={`px-3 py-1 text-sm rounded-md cursor-pointer ${selectedTimeframe === "yearly" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
                      >
                        Yearly
                      </button>
                    </div>
                  </div>
                  
                  {/* Date Range Filter */}
                  <div className="flex flex-wrap items-center gap-6 px-6 py-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Date Range:</span>
                    </div>
                    <div className="flex items-center gap-4">
                      {selectedTimeframe === 'yearly' ? (
                        // Year dropdowns for yearly view
                        <>
                          <select
                            value={getYearFromDate(filterStartDate)}
                            onChange={(e) => handleYearChange('start', e.target.value)}
                            className="border border-gray-300 rounded-md px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white min-w-[110px]"
                          >
                            <option value="">From Year</option>
                            {yearOptionsAsc.map(year => (
                              <option key={year} value={year}>{year}</option>
                            ))}
                          </select>
                          <span className="text-gray-500 font-medium px-1">to</span>
                          <select
                            value={getYearFromDate(filterEndDate)}
                            onChange={(e) => handleYearChange('end', e.target.value)}
                            className="border border-gray-300 rounded-md px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white min-w-[110px]"
                          >
                            <option value="">To Year</option>
                            {yearOptionsDesc.map(year => (
                              <option key={year} value={year}>{year}</option>
                            ))}
                          </select>
                        </>
                      ) : selectedTimeframe === 'monthly' ? (
                        // Month-Year dropdowns for monthly view
                        <>
                          <select
                            value={getMonthYearFromDate(filterStartDate)}
                            onChange={(e) => handleMonthYearChange('start', e.target.value)}
                            className="border border-gray-300 rounded-md px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white min-w-[130px]"
                          >
                            <option value="">From Month</option>
                            {monthYearOptionsAsc.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                          <span className="text-gray-500 font-medium px-1">to</span>
                          <select
                            value={getMonthYearFromDate(filterEndDate)}
                            onChange={(e) => handleMonthYearChange('end', e.target.value)}
                            className="border border-gray-300 rounded-md px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white min-w-[130px]"
                          >
                            <option value="">To Month</option>
                            {monthYearOptions.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </>
                      ) : (
                        // Date inputs for daily view
                        <>
                          <input
                            type="date"
                            value={filterStartDate}
                            onChange={(e) => handleDateRangeChange('start', e.target.value)}
                            className="border border-gray-300 rounded-md px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <span className="text-gray-500 font-medium px-1">to</span>
                          <input
                            type="date"
                            value={filterEndDate}
                            onChange={(e) => handleDateRangeChange('end', e.target.value)}
                            className="border border-gray-300 rounded-md px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </>
                      )}
                    </div>
                    {(filterStartDate || filterEndDate) && (
                      <button
                        onClick={clearDateRange}
                        className="px-4 py-2 text-sm text-white bg-gray-500 hover:bg-gray-600 rounded-md cursor-pointer transition-colors"
                      >
                        Clear
                      </button>
                    )}
                    <div className="flex items-center gap-2 ml-auto">
                      <span className="text-sm text-gray-600 bg-gray-200 px-3 py-1.5 rounded-md font-medium">
                        Max: {selectedTimeframe === 'daily' ? '30 days' : selectedTimeframe === 'monthly' ? '12 months' : '10 years'}
                      </span>
                    </div>
                    {dateRangeError && (
                      <span className="w-full text-sm text-red-600 font-medium bg-red-50 px-3 py-1.5 rounded-md">{dateRangeError}</span>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h3 className="text-lg font-medium mb-2">
                      {filterStartDate && filterEndDate && !dateRangeError ? 'Applications in Range' : 'Total Applications'}
                    </h3>
                    <p className="text-3xl font-bold">{stats.total}</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <h3 className="text-lg font-medium mb-2">
                      {filterStartDate && filterEndDate && !dateRangeError ? 'Monthly Breakdown' : 'Applications This Month'}
                    </h3>
                    <p className="text-3xl font-bold">
                      {stats.monthly.length > 0 ? stats.monthly.reduce((sum, m) => sum + m.count, 0) : 0}
                    </p>
                    {filterStartDate && filterEndDate && !dateRangeError && (
                      <p className="text-xs text-gray-500 mt-1">{stats.monthly.length} month(s)</p>
                    )}
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4">
                    <h3 className="text-lg font-medium mb-2">
                      {filterStartDate && filterEndDate && !dateRangeError ? 'Yearly Breakdown' : 'Applications This Year'}
                    </h3>
                    <p className="text-3xl font-bold">
                      {stats.yearly.length > 0 ? stats.yearly.reduce((sum, y) => sum + y.count, 0) : 0}
                    </p>
                    {filterStartDate && filterEndDate && !dateRangeError && (
                      <p className="text-xs text-gray-500 mt-1">{stats.yearly.length} year(s)</p>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <h3 className="text-lg font-medium mb-4">Applications Over Time</h3>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={selectedTimeframe === "daily" ? stats.daily : 
                                selectedTimeframe === "monthly" ? stats.monthly : stats.yearly}
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey={selectedTimeframe === "daily" ? "date" : 
                                    selectedTimeframe === "monthly" ? "month" : "year"} 
                          />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="count">
                            {(selectedTimeframe === "daily" ? stats.daily : 
                              selectedTimeframe === "monthly" ? stats.monthly : stats.yearly).map((entry, idx) => (
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
                            data={stats.status.filter(s => s.value > 0)}
                            cx="50%"
                            cy="45%"
                            outerRadius={70}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ value }) => {
                              const total = stats.status.reduce((sum, s) => sum + s.value, 0);
                              const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                              return pct > 0 ? `${pct}%` : '';
                            }}
                            labelLine={false}
                          >
                            {stats.status.filter(s => s.value > 0).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[statusOptions.indexOf(entry.name) % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value, name) => {
                            const total = stats.status.reduce((sum, s) => sum + s.value, 0);
                            const pct = total > 0 ? ((value as number / total) * 100).toFixed(1) : '0';
                            return [`${value} applications (${pct}%)`, name];
                          }} />
                          <Legend 
                            layout="horizontal" 
                            verticalAlign="bottom" 
                            align="center"
                            wrapperStyle={{ paddingTop: '20px' }}
                          />
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
                    className="text-blue-600 hover:text-blue-800 cursor-pointer"
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
                      className="flex items-center justify-center space-x-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 cursor-pointer"
                    >
                      <Plus className="h-5 w-5" />
                      <span>Add Application</span>
                    </button>
                    <button 
                      onClick={handleExport}
                      className="flex items-center justify-center space-x-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 cursor-pointer"
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
                      className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer"
                    >
                      Expand All
                    </button>
                    <span className="text-gray-300">|</span>
                    <button 
                      onClick={collapseAllCompanies}
                      className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer"
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
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer whitespace-nowrap min-w-[120px]"
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
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer whitespace-nowrap min-w-[120px]"
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
                              <td className="px-6 py-3 font-medium whitespace-nowrap">
                                <span className="inline-flex items-center">
                                  {group.companyName}
                                  <span className="ml-2 text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                                    {group.applications.length} role{group.applications.length !== 1 ? 's' : ''}
                                  </span>
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
                                  <td className="px-6 py-3 whitespace-nowrap">{app.role}</td>
                                  <td className="px-6 py-3 whitespace-nowrap">{formatDisplayDate(app.dateApplied)}</td>
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
                                    <div className="grid grid-cols-2 gap-1 max-w-[280px]">
                                      {app.files.map((file, index) => (
                                        <a
                                          key={index}
                                          href={
                                            file.id 
                                              ? `/api/uploads/${file.id}`
                                              : file.url?.startsWith('/uploads/') 
                                                ? file.url 
                                                : `/api/blob-proxy?key=${encodeURIComponent(file.storage_key || file.storageKey || file.key || file.name)}`
                                          }
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="px-2 py-1 bg-gray-100 text-xs rounded-md flex items-center hover:underline"
                                          title={file.name}
                                        >
                                          <FileText className="h-3 w-3 mr-1 flex-shrink-0" />
                                          <span className="truncate">{file.name}</span>
                                        </a>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="px-6 py-3 text-sm font-medium">
                                    <div className="flex space-x-2">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleView(app.id); }}
                                        className="text-gray-600 hover:text-gray-900 cursor-pointer"
                                        title="View"
                                      >
                                        <Eye className="h-5 w-5" />
                                      </button>
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEdit(app.id);
                                        }}
                                        className="text-blue-600 hover:text-blue-900 cursor-pointer"
                                      >
                                        <Edit className="h-5 w-5" />
                                      </button>
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDelete(app.id);
                                        }}
                                        className="text-red-600 hover:text-red-900 cursor-pointer"
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
                className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col"
              >
                <div className="p-6 overflow-y-auto flex-1 pb-20">
                    <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold">{viewingId ? "View Application" : (editingId ? "Edit Application" : "Add New Application")}</h2>
                    <button 
                      onClick={() => {
                        setShowAddForm(false);
                        setEditingId(null);
                        setViewingId(null);
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
                  
                  <form ref={formRef} onSubmit={viewingId ? (e)=>e.preventDefault() : handleSubmit} className="space-y-4">
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
                          readOnly={Boolean(viewingId)}
                          className={`w-full border rounded-md px-3 py-2 ${errors.companyId ? 'border-red-500' : ''}`}
                          aria-required="true"
                        />
                      </div>

                      {companyDropdownOpen && !viewingId && (
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
                          readOnly={Boolean(viewingId)}
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
                        readOnly={Boolean(viewingId)}
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
                        disabled={Boolean(viewingId)}
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
                        disabled={Boolean(viewingId)}
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
                        readOnly={Boolean(viewingId)}
                        className="w-full border rounded-md px-3 py-2 h-24"
                      />
                    </div>
                    
                    {(editingId || viewingId) && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status History</label>
                        <textarea
                          name="statusNotes"
                          value={newApplication.statusNotes || ''}
                          readOnly
                          rows={6}
                          wrap="soft"
                          style={{ whiteSpace: 'pre-wrap' }}
                          className="w-full border rounded-md px-3 py-2 h-40 bg-gray-50 text-sm text-gray-700 resize-none overflow-y-auto"
                        />
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Files</label>
                      <div className="space-y-2">
                        {newApplication.files.map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded-md">
                            <div className="flex items-center">
                              <FileText className="h-4 w-4 mr-2 text-gray-500" />
                              <span className="text-sm">{file.name}</span>
                            </div>
                            {!viewingId && (
                              <button 
                                type="button"
                                onClick={() => removeFile(file.name)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                          <div>
                            {!viewingId && (
                              <>
                                <input
                                  type="file"
                                  ref={fileInputRef}
                                  className="hidden"
                                  onChange={(e) => handleFileUpload(e, 'resume')}
                                />
                                <button
                                  type="button"
                                  onClick={() => fileInputRef.current?.click()}
                                  className="min-w-[180px] h-10 flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 rounded-md text-sm cursor-pointer"
                                >
                                  <Upload className="h-4 w-4" />
                                  <span className="truncate">Upload Resume</span>
                                </button>
                              </>
                            )}
                          </div>
                          <div>
                            {!viewingId && (
                              <>
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
                                  className="min-w-[180px] h-10 flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 rounded-md text-sm cursor-pointer"
                                >
                                  <Upload className="h-4 w-4" />
                                  <span className="truncate">Upload Cover Letter</span>
                                </button>
                              </>
                            )}
                          </div>
                          <div>
                            {!viewingId && (
                              <>
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
                                  className="min-w-[180px] h-10 flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 rounded-md text-sm cursor-pointer"
                                >
                                  <Upload className="h-4 w-4" />
                                  <span className="truncate">Upload Job Description</span>
                                </button>
                              </>
                            )}
                          </div>
                          <div>
                            {!viewingId && (
                              <>
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
                                  className="min-w-[180px] h-10 flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 rounded-md text-sm cursor-pointer"
                                >
                                  <Upload className="h-4 w-4" />
                                  <span className="truncate">Upload Application Doc</span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                  </form>
                </div>
                <div className="border-t p-4 bg-white flex justify-end gap-2">
                  {viewingId ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddForm(false);
                        setViewingId(null);
                        setCompanyQuery('');
                        setCompanyDropdownOpen(false);
                      }}
                      className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50 cursor-pointer"
                    >
                      Close
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddForm(false);
                          setEditingId(null);
                          setCompanyQuery('');
                          setCompanyDropdownOpen(false);
                        }}
                        className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => formRef.current?.requestSubmit?.() ?? formRef.current?.submit?.()}
                        disabled={isSaving}
                        className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer flex items-center space-x-2 ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                      >
                        {isSaving && (
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        )}
                        <span>{isSaving ? (editingId ? "Updating..." : "Saving...") : (editingId ? "Update" : "Save")}</span>
                      </button>
                    </>
                  )}
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