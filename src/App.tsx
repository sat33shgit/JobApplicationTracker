import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import SimpleModal from './components/SimpleModal';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import { normalizeDateToInput, getTodayISO } from './utils/date';
// ...existing code...
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
const statusOptions = [
  "Applied",
  "System Rejected",
  "Email Enquiry",
  "Preliminary Call",
  "Interview",
  "Offer",
  "Rejected",
  "Withdrawn"
];

// Colors for charts
const COLORS = [
  '#0088FE', // Applied
  '#687530', // System Rejected
  '#F39C12', // Email Enquiry (orange/yellow for visibility)
  '#397D58', // Preliminary Call
  '#00C49F', // Interview
  '#FFBB28', // Offer
  '#FF8042', // Rejected
  '#8884d8'  // Withdrawn
];

// Function to generate statistics based on date range, timeframe and optional status
const generateStats = (applications, startDate?: string, endDate?: string, timeframe: string = 'daily', status?: string) => {
  // Filter applications by date range if provided (use numeric timestamps for speed)
  let filteredApps = [...applications];
  if (startDate && endDate) {
    const sTs = new Date(startDate + 'T00:00:00').getTime();
    const eTs = new Date(endDate + 'T23:59:59').getTime();
    filteredApps = applications.filter(app => {
      const ts = app.dateAppliedTs || (app.dateApplied ? new Date(app.dateApplied + 'T00:00:00').getTime() : 0);
      return ts >= sTs && ts <= eTs;
    });
  }

  // If a status filter is provided, apply it on top of the date filtering
  if (status) {
    filteredApps = filteredApps.filter(app => app.status === status);
  }

  const start = startDate ? new Date(startDate + 'T00:00:00') : new Date();
  const end = endDate ? new Date(endDate + 'T23:59:59') : new Date();
  
  // Daily stats - each day in the range
  const dailyStats = [];
  if (startDate && endDate) {
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dayStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 0, 0, 0).getTime();
      const dayEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 23, 59, 59).getTime();
      const count = filteredApps.filter(app => {
        const ts = app.dateAppliedTs || (app.dateApplied ? new Date(app.dateApplied + 'T00:00:00').getTime() : 0);
        return ts >= dayStart && ts <= dayEnd;
      }).length;
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
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0).getTime();
      const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59).getTime();
      const count = filteredApps.filter(app => {
        const ts = app.dateAppliedTs || (app.dateApplied ? new Date(app.dateApplied + 'T00:00:00').getTime() : 0);
        return ts >= dayStart && ts <= dayEnd;
      }).length;
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
        const ts = app.dateAppliedTs || (app.dateApplied ? new Date(app.dateApplied + 'T00:00:00').getTime() : 0);
        return ts >= monthStart.getTime() && ts <= monthEnd.getTime();
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
      
      const count = filteredApps.filter(app => {
        const ts = app.dateAppliedTs || (app.dateApplied ? new Date(app.dateApplied + 'T00:00:00').getTime() : 0);
        return ts >= monthStart.getTime() && ts <= monthEnd.getTime();
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
        const ts = app.dateAppliedTs || (app.dateApplied ? new Date(app.dateApplied + 'T00:00:00').getTime() : 0);
        return ts >= yearStart.getTime() && ts <= yearEnd.getTime();
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
      
      const count = filteredApps.filter(app => {
        const ts = app.dateAppliedTs || (app.dateApplied ? new Date(app.dateApplied + 'T00:00:00').getTime() : 0);
        return ts >= yearStart.getTime() && ts <= yearEnd.getTime();
      }).length;
      
      yearlyStats.push({
        year: year.toString(),
        count
      });
    }
  }
  
  // Status distribution - based on filtered applications
  const statusStats = statusOptions.map(s => ({
    name: s,
    value: filteredApps.filter(app => app.status === s).length
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
  // Render pie labels outside the pie to avoid overlap
  const renderPieLabel = (props: any) => {
    const { cx, cy, midAngle, outerRadius, percent, index } = props;
    const rad = Math.PI / 180;
    const pct = Math.round((percent || 0) * 100);
    if (pct === 0) return null;

    // Increase radius for very small slices so labels don't overlap the pie
    let extra = 18;
    if (pct <= 2) extra += 20;
    else if (pct <= 5) extra += 12;

    const radius = outerRadius + extra; // distance from center
    const xBase = cx + radius * Math.cos(-midAngle * rad);
    const yBase = cy + radius * Math.sin(-midAngle * rad);

    // Small-slice labels can still collide; apply a small vertical stagger based on index
    const stagger = pct <= 5 ? (index % 2 === 0 ? -8 : 8) : 0;
    const x = xBase;
    const y = yBase + stagger;

    const fill = COLORS[index % COLORS.length] || '#333';
    return (
      <text x={x} y={y} fill={fill} fontSize={12} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
        {pct}%
      </text>
    );
  };
  const [companies, setCompanies] = useState(initialCompanies);
  const [applications, setApplications] = useState(initialApplications);
  const [selectedTimeframe, setSelectedTimeframe] = useState("yearly");
  
  // Date range filter state
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [dateRangeError, setDateRangeError] = useState("");
  const [selectedStatus, setSelectedStatus] = useState('');
  
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
  const clearDateRange = useCallback(() => {
    setFilterStartDate('');
    setFilterEndDate('');
    setDateRangeError('');
    setSelectedStatus('');
    try {
      const params = new URLSearchParams(window.location.search);
      params.delete('start');
      params.delete('end');
      params.delete('status');
      const newQuery = params.toString();
      const newUrl = newQuery ? `${window.location.pathname}?${newQuery}` : window.location.pathname;
      window.history.pushState({}, '', newUrl);
    } catch (e) {
      // ignore in non-browser environments
    }
  }, []);
  
  // Clear search input and reset applications view to default (no search)
  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
    setCurrentPage(1);
    setExpandedCompanies({});
    try {
      const params = new URLSearchParams(window.location.search);
      params.delete('q');
      const newQuery = params.toString();
      const newUrl = newQuery ? `${window.location.pathname}?${newQuery}` : window.location.pathname;
      window.history.pushState({}, '', newUrl);
    } catch (e) {
      // ignore
    }
  }, []);

  // Open Applications tab and pass current filters via query params
  const openApplicationsWithFilters = useCallback(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (filterStartDate) params.set('start', filterStartDate);
      else params.delete('start');
      if (filterEndDate) params.set('end', filterEndDate);
      else params.delete('end');
      if (selectedTimeframe) params.set('timeframe', selectedTimeframe);
      if (selectedStatus) params.set('status', selectedStatus);
      else params.delete('status');
      const q = params.toString();
      const newUrl = q ? `${window.location.pathname}?${q}` : window.location.pathname;
      window.history.pushState({}, '', newUrl);
      if (selectedStatus) params.set('status', selectedStatus);
      else params.delete('status');
    } catch (e) {
      // ignore
    }
    // ensure Applications page shows collapsed rows and resets pagination
    setExpandedCompanies({});
    setCurrentPage(1);
    setActiveTab('applications');
  }, [filterStartDate, filterEndDate, selectedTimeframe, selectedStatus]);

  // Open Applications tab with no filters (clear local filters and URL params)
  const openApplicationsNoFilters = useCallback(() => {
    // Clear local filter state
    setFilterStartDate('');
    setFilterEndDate('');
    setDateRangeError('');
    setSelectedTimeframe('yearly');
    setSelectedStatus('');
    setSearchTerm('');
    setDebouncedSearchTerm('');
    setCurrentPage(1);
    setExpandedCompanies({});

    // Remove filter/query params from URL
    try {
      const params = new URLSearchParams(window.location.search);
      params.delete('start');
      params.delete('end');
      params.delete('timeframe');
      params.delete('q');
      const newQuery = params.toString();
      const newUrl = newQuery ? `${window.location.pathname}?${newQuery}` : window.location.pathname;
      window.history.pushState({}, '', newUrl);
    } catch (e) {
      // ignore in non-browser environments
    }

    setActiveTab('applications');
  }, []);
  
  // Compute stats with date range & status filter
  const stats = useMemo(() => {
    const hasDateSelection = filterStartDate || filterEndDate;
    const hasValidRange = filterStartDate && filterEndDate && !dateRangeError;
    
    // If user has selected dates but there's an error, return empty stats
    if (hasDateSelection && dateRangeError) {
      return {
        daily: [],
        monthly: [],
        yearly: [],
        status: statusOptions.map(s => ({ name: s, value: 0 })),
        total: 0
      };
    }
    
    return generateStats(
      applications, 
      hasValidRange ? filterStartDate : undefined, 
      hasValidRange ? filterEndDate : undefined,
      selectedTimeframe,
      selectedStatus || undefined
    );
  }, [applications, filterStartDate, filterEndDate, dateRangeError, selectedTimeframe, selectedStatus]);
  
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Load jobs from the API on first render and map them into the app's shape
  useEffect(() => {
    let mounted = true;
    async function loadJobs() {
      try {
        const resp = await fetch('/api/jobs');
        if (!resp.ok) {
          // ...existing code...
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
          const dateAppliedTs = dateApplied ? new Date(dateApplied + 'T00:00:00').getTime() : 0;
          return {
            id: r.id,
            companyId,
            role: r.title || '',
            dateApplied,
            dateAppliedTs,
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
        // ...existing code...
      }
    }

    loadJobs();
    return () => { mounted = false; };
  }, []);

  // Read filters from URL query params on load and apply them (navigate to applications)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const start = params.get('start');
      const end = params.get('end');
      const timeframe = params.get('timeframe');
      // Remove status filter auto-application
      if (start || end || timeframe) {
        if (start) setFilterStartDate(start);
        if (end) setFilterEndDate(end);
        if (timeframe) setSelectedTimeframe(timeframe);
        setActiveTab('applications');
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // Scroll to top when Applications tab becomes active
  useEffect(() => {
    if (activeTab === 'applications') {
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (e) {
        // ignore in non-browser environments
      }
    }
  }, [activeTab]);
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
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(id);
  }, [searchTerm]);
  // Focus the new company input when user selects "Add new company"
  useEffect(() => {
    if (newApplication.companyId === 'new') {
      // focus after input mounts
      setTimeout(() => newCompanyRef.current && newCompanyRef.current.focus(), 0);
    }
  }, [newApplication.companyId]);
  const [editingId, setEditingId] = useState(null);
  const [viewingId, setViewingId] = useState(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expandedCompanies, setExpandedCompanies] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const jobDescInputRef = useRef(null);
  const appDocInputRef = useRef(null);
  const newCompanyRef = useRef<HTMLInputElement | null>(null);
  const [dragResume, setDragResume] = useState(false);
  const [dragCover, setDragCover] = useState(false);
  const [dragJobDesc, setDragJobDesc] = useState(false);
  const [dragAppDoc, setDragAppDoc] = useState(false);
  const dragResumeCounter = useRef(0);
  const dragCoverCounter = useRef(0);
  const dragJobDescCounter = useRef(0);
  const dragAppDocCounter = useRef(0);
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

  // Recent applications - last 10 by dateApplied (descending)
  const recentApplications = useMemo(() => {
    return [...applications]
      .filter(a => a.dateApplied)
      .sort((a, b) => {
        const da = a.dateAppliedTs || (a.dateApplied ? new Date(a.dateApplied).getTime() : 0);
        const db = b.dateAppliedTs || (b.dateApplied ? new Date(b.dateApplied).getTime() : 0);
        return db - da;
      })
      .slice(0, 10);
  }, [applications]);


  // Filter applications based on search term - respects `sortedApplications` ordering
  const filteredApplications = useMemo(() => sortedApplications.filter(app => {
    const company = companyMap.get(app.companyId) || '';
    const searchString = `${company} ${app.role} ${app.status} ${app.notes}`.toLowerCase();
    if (!searchString.includes(debouncedSearchTerm.toLowerCase())) return false;
    // Apply status filter if selected so Applications page reflects dashboard selection
    if (selectedStatus && app.status !== selectedStatus) return false;
    // If a valid date range is selected, apply date filtering here so the Applications
    // page shows only rows within the selected range when navigated from Dashboard.
    const hasValidRange = filterStartDate && filterEndDate && !dateRangeError;
    if (!hasValidRange) return true;
    const s = new Date(filterStartDate + 'T00:00:00').getTime();
    const e = new Date(filterEndDate + 'T23:59:59').getTime();
    const d = app.dateAppliedTs || (app.dateApplied ? new Date(app.dateApplied + 'T00:00:00').getTime() : 0);
    return d >= s && d <= e;
  }), [sortedApplications, companies, debouncedSearchTerm, filterStartDate, filterEndDate, dateRangeError, selectedStatus]);

  const filteredApplicationsCount = useMemo(() => filteredApplications.length, [filteredApplications]);
  const filteredCompaniesCount = useMemo(() => {
    const s = new Set<number>();
    filteredApplications.forEach(a => s.add(a.companyId));
    return s.size;
  }, [filteredApplications]);

  // Apply date range filters (if any) on top of search-filtered applications for summary counts
  const filteredForCounts = useMemo(() => {
    const hasValidRange = filterStartDate && filterEndDate && !dateRangeError;
    // Start from the search-filtered applications
    let base = filteredApplications;

    // If a status is selected, apply it now so total counts reflect status filter
    if (selectedStatus) {
      base = base.filter(app => app.status === selectedStatus);
    }

    // If there's no date range, return base (which may have status applied)
    if (!hasValidRange) return base;

    const s = new Date(filterStartDate + 'T00:00:00').getTime();
    const e = new Date(filterEndDate + 'T23:59:59').getTime();

    // Apply date filter on top of base using timestamps
    base = base.filter(app => {
      const d = app.dateAppliedTs || (app.dateApplied ? new Date(app.dateApplied + 'T00:00:00').getTime() : 0);
      return d >= s && d <= e;
    });

    return base;
  }, [filteredApplications, filterStartDate, filterEndDate, dateRangeError, selectedStatus]);

  const totalCompanies = useMemo(() => {
    const set = new Set<number>();
    filteredForCounts.forEach(a => set.add(a.companyId));
    return set.size;
  }, [filteredForCounts]);

  // Group applications by company - memoized
  // Also sort each group's applications by `dateApplied` descending (newest first)
  const groupedApplications = useMemo(() => {
    const groups = filteredApplications.reduce((acc, app) => {
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
    }, {} as Record<number, any>);

    // Sort applications within each group by applied date (descending)
    Object.values(groups).forEach((g: any) => {
      g.applications.sort((a: any, b: any) => {
        const ta = a.dateAppliedTs || (a.dateApplied ? new Date(a.dateApplied).getTime() : 0);
        const tb = b.dateAppliedTs || (b.dateApplied ? new Date(b.dateApplied).getTime() : 0);
        return tb - ta;
      });
    });

    return groups;
  }, [filteredApplications, companies, companyMap]);

  // Sort grouped applications - memoized
  const sortedGroupedApplications = useMemo(() => Object.values(groupedApplications).sort((a: any, b: any) => {
    if (sortConfig.key === 'companyId') {
      return sortConfig.direction === 'asc'
        ? a.companyName.localeCompare(b.companyName)
        : b.companyName.localeCompare(a.companyName);
    }
    return 0;
  }), [groupedApplications, sortConfig]);

  // Pagination for companies list (applications page)
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(sortedGroupedApplications.length / pageSize));

  // Ensure current page stays within bounds when data changes
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
    if (currentPage < 1) setCurrentPage(1);
  }, [currentPage, totalPages]);

  const paginatedGroupedApplications = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedGroupedApplications.slice(start, start + pageSize);
  }, [sortedGroupedApplications, currentPage]);

  // Toggle expand/collapse for a company.
  // When expanding a company, collapse all other company groups so only one is open at a time.
  const toggleCompanyExpand = useCallback((companyId) => {
    setExpandedCompanies(prev => {
      const isOpen = !!prev[companyId];
      if (isOpen) {
        // collapse if already open
        return {};
      }
      // expand this one and collapse others
      return { [companyId]: true };
    });
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

  // Accept an array-like FileList or array of File objects and attach them
  const handleFiles = (filesLike, fileType) => {
    const files = Array.from(filesLike || []);
    if (files.length === 0) return;

    const newFiles = files.map(file => ({
      file,
      name: file.name,
      type: fileType,
      url: null
    }));

    setNewApplication(prev => ({ ...prev, files: [...prev.files, ...newFiles] }));
  };

  // Handle file upload from input change events
  const handleFileUpload = (e, fileType) => {
    handleFiles(e.target.files, fileType);
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
        const filesToUpload = Array.isArray(newApplication.files) ? newApplication.files.filter(f => f && f.file) : [];
        let attachments = [];
        // ...existing code...
        if (filesToUpload.length) {
          try {
            attachments = await Promise.all(filesToUpload.map(async (f) => {
              try {
                const res = await uploadFileToServer(updated.id, f);
                // ...existing code...
                return res;
              } catch (uerr) {
                // ...existing code...
                throw uerr;
              }
            }));
          } catch (e) {
            // ...existing code...
            toast.error('One or more attachments failed to upload.');
            // Continue — do not abort the whole submit; user can retry attachments
          }

          if (attachments && attachments.length) {
            const attachMeta = attachments.map(a => ({ name: a.filename || a.name, url: a.url || a.url, id: a.id }));
            const existingFiles = (updated.metadata && Array.isArray(updated.metadata.files)) ? updated.metadata.files : [];
            const mergedFiles = [...existingFiles, ...attachMeta];
            // patch job metadata to include merged attachments
            try {
              const metaResp = await fetch(`/api/jobs/${updated.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ metadata: { ...(updated.metadata || {}), files: mergedFiles } })
              });
              // ...existing code...
            } catch (pmErr) {
              // ...existing code...
            }
            updated.metadata = { ...(updated.metadata || {}), files: mergedFiles };
          }
        }

        setApplications(applications.map(app => app.id === editingId ? {
          ...app,
          companyId,
          role: updated.title,
          dateApplied: normalizeDateToInput(updated.applied_date),
          dateAppliedTs: updated.applied_date ? new Date(normalizeDateToInput(updated.applied_date) + 'T00:00:00').getTime() : (app.dateAppliedTs || 0),
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
          dateAppliedTs: created.applied_date ? new Date(normalizeDateToInput(created.applied_date) + 'T00:00:00').getTime() : 0,
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
      // ...existing code...
      toast.error('Failed to save application. See console for details.');
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
      setShowAddForm(false);
      setEditingId(null);
      setViewingId(null);
      setCompanyQuery('');
      setCompanyDropdownOpen(false);
      setActiveTab('applications');
    } catch (err) {
      // ...existing code...
      toast.error('Failed to delete application. See console for details.');
    }
  };

  const cancelDelete = () => {
    setDeleteTarget(null);
    setConfirmOpen(false);
  };

  // Open Add Application dialog (reset form)
  const openAddForm = useCallback(() => {
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
    setShowAddForm(true);
  }, []);

  // Open Add Application form prepopulated for a specific company
  const openAddForCompany = useCallback((companyId, companyName) => {
    setEditingId(null);
    setViewingId(null);
    setNewApplication({
      companyId: String(companyId),
      newCompany: '',
      role: '',
      dateApplied: getTodayISO(),
      status: 'Applied',
      notes: '',
      files: []
    });
    setCompanyQuery(companyName || '');
    setCompanyDropdownOpen(false);
    setShowAddForm(true);
  }, []);

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
      toast.error('No applications to export.');
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

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const importFileRef = useRef<HTMLInputElement | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Clear selected file when modal is closed
  useEffect(() => {
    if (!showImportModal && importFileRef.current) {
      try { importFileRef.current.value = ''; } catch(e) { /* ignore */ }
    }
  }, [showImportModal]);

  const handleImportClick = () => {
    setShowImportModal(true);
  };

  const supportedStatuses = new Set(statusOptions.map(s => s.toLowerCase()));

  const handleImportFile = async (file: File | null) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith('.xls') && !name.endsWith('.xlsx')) {
      toast.error('Only .xls and .xlsx files are supported');
      return;
    }
    setIsImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      const rows: Array<any> = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

      if (!rows.length) {
        toast.error('No data found in the sheet');
        setIsImporting(false);
        return;
      }

      // Normalize headers (case-insensitive)
      const firstRow = rows[0];
      const headerMap: Record<string, string> = {};
      Object.keys(firstRow).forEach(h => headerMap[h.trim().toLowerCase()] = h);

      const reqCols = ['company name', 'role', 'date applied', 'status'];
      const missing = reqCols.filter(c => !Object.prototype.hasOwnProperty.call(headerMap, c));
      if (missing.length > 0) {
        toast.error(`Missing columns: ${missing.join(', ')}`);
        setIsImporting(false);
        return;
      }

      let createdCount = 0;
      let failedCount = 0;

      for (const r of rows) {
        const companyName = (r[headerMap['company name']] || '').toString().trim();
        const role = (r[headerMap['role']] || '').toString().trim();
        const dateVal = r[headerMap['date applied']];
        const statusVal = (r[headerMap['status']] || '').toString().trim();

        if (!companyName || !role) {
          failedCount++;
          continue;
        }

        // Normalize status
        const statusNorm = statusVal && supportedStatuses.has(statusVal.toLowerCase())
          ? statusOptions.find(s => s.toLowerCase() === statusVal.toLowerCase())
          : 'Applied';

        // Normalize date - try to parse; fallback to today
        let applied_date = getTodayISO();
        if (dateVal) {
          try {
            const parsed = new Date(dateVal);
            if (!isNaN(parsed.getTime())) applied_date = normalizeDateToInput(parsed);
            else applied_date = normalizeDateToInput(dateVal);
          } catch (e) {
            applied_date = getTodayISO();
          }
        }

        const payload = {
          title: role,
          company: companyName,
          status: statusNorm,
          applied_date,
          metadata: { notes: null, files: [] }
        };

        try {
          const resp = await fetch('/api/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (!resp.ok) throw new Error('Failed');
          const created = await resp.json();
          setApplications(prev => [...prev, {
            id: created.id,
            companyId: created.company_id || created.companyId || 0,
            role: created.title,
            dateApplied: normalizeDateToInput(created.applied_date),
            dateAppliedTs: created.applied_date ? new Date(normalizeDateToInput(created.applied_date) + 'T00:00:00').getTime() : 0,
            status: created.status,
            notes: created.metadata?.notes || '',
            files: created.metadata?.files || [],
            statusNotes: created.status_notes || ''
          }]);
          createdCount++;
        } catch (e) {
          failedCount++;
        }
      }

      toast.success(`Import finished. Created: ${createdCount}, Failed: ${failedCount}`);
      setShowImportModal(false);
    } catch (err) {
      // ...existing code...
      toast.error('Import failed. See console for details.');
    } finally {
      setIsImporting(false);
    }
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
      <Toaster />
      {/* Header */}
      <header className="sticky top-0 bg-white shadow-md py-4 px-6 z-50">
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
          <div className="ml-4">
            <button
              onClick={openAddForm}
              className="px-3 py-2 bg-blue-600 text-white rounded-md flex items-center gap-2 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              <span>Add application</span>
            </button>
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

      {/* Import modal */}
      {showImportModal && (
        <SimpleModal open={showImportModal} onClose={() => setShowImportModal(false)} titleId="import-title" descriptionId="import-desc">
          <div className="flex justify-between items-start">
            <div>
              <h3 id="import-title" className="text-lg font-semibold">Import Applications</h3>
              <p id="import-desc" className="text-sm text-gray-600">The xls file should have the column names 'company name', 'Role', 'Date Applied', 'status'.</p>
            </div>
            <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <div className="mt-4">
            <input
              ref={(el) => (importFileRef.current = el)}
              type="file"
              accept=".xls,.xlsx"
            />
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={() => setShowImportModal(false)} className="px-4 py-2 border rounded mr-2">Cancel</button>
            <button
              onClick={() => handleImportFile(importFileRef.current?.files ? importFileRef.current.files[0] : null)}
              disabled={isImporting || !(importFileRef.current && importFileRef.current.files && importFileRef.current.files.length)}
              className={`px-4 py-2 bg-gray-200 rounded ${isImporting ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isImporting ? 'Importing...' : 'Upload'}
            </button>
          </div>
        </SimpleModal>
      )}

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
                    <div className="flex items-center gap-2">
                      {selectedTimeframe === 'yearly' ? (
                        // Year dropdowns for yearly view
                        <>
                          <select
                            value={getYearFromDate(filterStartDate)}
                            onChange={(e) => handleYearChange('start', e.target.value)}
                            className="border border-gray-300 rounded-md px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white min-w-[110px]"
                          >
                            <option value="">From Year</option>
                            {yearOptionsDesc.map(year => (
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
                            {monthYearOptions.map(opt => (
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
                    <div className="flex items-center gap-3">
                      <label className="text-sm text-gray-700">Status:</label>
                      <select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                      >
                        <option value="">All Statuses</option>
                        {statusOptions.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        onClick={clearDateRange}
                        disabled={!(filterStartDate || filterEndDate || selectedStatus)}
                        className={`px-4 py-2 text-sm rounded-md transition-colors ${!(filterStartDate || filterEndDate || selectedStatus) ? 'bg-gray-100 text-gray-400 cursor-not-allowed border' : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'}`}
                      >
                        Clear
                      </button>
                      <span className="text-sm text-gray-600 bg-gray-200 px-3 py-1.5 rounded-md font-medium whitespace-nowrap">
                        Max: {selectedTimeframe === 'daily' ? '30 days' : selectedTimeframe === 'monthly' ? '12 months' : '10 years'}
                      </span>
                    </div>
                    {dateRangeError && (
                      <span className="w-full text-sm text-red-600 font-medium bg-red-50 px-3 py-1.5 rounded-md">{dateRangeError}</span>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col md:flex-row gap-6 mb-6">
                  <div className="bg-blue-50 rounded-lg p-4 w-full md:w-1/2">
                    <h3 className="text-lg font-medium mb-2">
                      {filterStartDate && filterEndDate && !dateRangeError ? 'Applications in Range' : 'Total Applications'}
                    </h3>
                    <p className="text-3xl font-bold">{stats.total}</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4 w-full md:w-1/2">
                    <h3 className="text-lg font-medium mb-2">Total Companies</h3>
                    <p className="text-3xl font-bold">{totalCompanies}</p>
                    <p className="text-xs text-gray-500 mt-1">Unique companies in current filters</p>
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
                            label={renderPieLabel}
                            labelLine={true}
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
                        <div className="mt-4 flex justify-center">
                          <button
                            onClick={openApplicationsWithFilters}
                            disabled={stats.total === 0}
                            className={`px-4 py-2 text-sm rounded-md transition-colors ${stats.total === 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed border' : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'}`}
                          >
                            View Results
                          </button>
                        </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold">Recent Applications</h2>
                  <button 
                    onClick={openApplicationsNoFilters}
                    className="text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    View All
                  </button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Applied</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {recentApplications.map((app) => (
                        <tr key={app.id}>
                          <td className="px-6 py-4">{getCompanyName(app.companyId)}</td>
                          <td className="px-6 py-4">{app.role}</td>
                          <td className="px-6 py-4">{formatDisplayDate(app.dateApplied)}</td>
                          <td className="px-6 py-4">
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
                  {(filterStartDate || filterEndDate || selectedStatus) && !dateRangeError && (
                    <div className="mb-4 p-3 rounded-md bg-blue-50 border border-blue-100 flex items-center justify-between">
                      <div className="text-sm text-blue-700">
                        Showing {filteredApplicationsCount} applications / {filteredCompaniesCount} companies
                        {(filterStartDate || filterEndDate) && !dateRangeError ? (
                          <span> for: {filterStartDate ? formatDisplayDate(filterStartDate) : 'Any'} to {filterEndDate ? formatDisplayDate(filterEndDate) : 'Any'}</span>
                        ) : null}
                        {selectedStatus ? <span> · Status: {selectedStatus}</span> : null}
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={clearDateRange}
                          className="text-sm px-3 py-1 bg-white border rounded-md text-blue-600 hover:bg-blue-50 cursor-pointer"
                        >
                          Clear filter
                        </button>
                      </div>
                    </div>
                  )}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 space-y-4 md:space-y-0">
                  <h2 className="text-xl font-semibold">Job Applications</h2>
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                    <div className="flex items-center space-x-2">
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
                        onClick={clearSearch}
                        className="text-sm px-3 py-2 bg-white border rounded-md text-gray-700 hover:bg-gray-50 cursor-pointer"
                        aria-label="Clear search"
                      >
                        Clear
                      </button>
                    </div>
                    <button 
                      onClick={() => { setShowAddForm(true); setCompanyQuery(''); setEditingId(null); }}
                      className="flex items-center justify-center space-x-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 cursor-pointer"
                    >
                      <Plus className="h-5 w-5" />
                      <span>Add Application</span>
                    </button>
                    <button 
                      onClick={handleImportClick}
                      className="flex items-center justify-center space-x-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 cursor-pointer"
                    >
                      <FileSpreadsheet className="h-5 w-5" />
                      <span>Import</span>
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
                
                <div className="mb-4 flex justify-between items-center">
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
                  {/* Pagination controls for companies list */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className={`px-2 py-1 text-sm rounded-md ${currentPage === 1 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-white border'}`}
                    >
                      First
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className={`px-2 py-1 text-sm rounded-md ${currentPage === 1 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-white border'}`}
                    >
                      Prev
                    </button>
                    <span className="text-sm text-gray-700 px-2">Page {currentPage} / {totalPages}</span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className={`px-2 py-1 text-sm rounded-md ${currentPage === totalPages ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-white border'}`}
                    >
                      Next
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className={`px-2 py-1 text-sm rounded-md ${currentPage === totalPages ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-white border'}`}
                    >
                      Last
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
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer whitespace-normal min-w-[120px]"
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
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer whitespace-normal min-w-[120px]"
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
                      {paginatedGroupedApplications.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                            No applications found. Add your first application!
                          </td>
                        </tr>
                      ) : (
                        paginatedGroupedApplications.map((group: any) => (
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
                              <td className="px-6 py-3 font-medium whitespace-normal break-words">
                                <span className="inline-flex items-center">
                                  {group.companyName}
                                  <span className="ml-2 text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                                    {group.applications.length} role{group.applications.length !== 1 ? 's' : ''}
                                  </span>
                                </span>
                              </td>
                              <td colSpan={5} className="px-6 py-3 text-sm text-gray-500">
                                <div className="relative">
                                  <div className="absolute inset-y-0 left-0 right-36 flex items-center justify-center pointer-events-none">
                                    <div className="text-sm text-gray-500">Click to {expandedCompanies[group.companyId] ? 'collapse' : 'expand'}</div>
                                  </div>
                                  <div className="flex items-center justify-end space-x-3 relative z-10">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); openAddForCompany(group.companyId, group.companyName); }}
                                      className="text-sm px-3 py-1 bg-white border rounded-md text-blue-600 hover:bg-blue-50 cursor-pointer"
                                    >
                                      Add Role
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                            
                            {/* Application Rows */}
                            {expandedCompanies[group.companyId] && 
                              group.applications.map(app => (
                                <tr key={app.id} className="hover:bg-gray-50">
                                  <td className="px-2 py-3"></td>
                                  <td className="px-6 py-3 pl-10 whitespace-normal break-words">
                                    <span className="text-gray-400">{group.companyName}</span>
                                  </td>
                                  <td className="px-6 py-3 whitespace-normal break-words">{app.role}</td>
                                  <td className="px-6 py-3 whitespace-normal break-words">{formatDisplayDate(app.dateApplied)}</td>
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
                          ref={newCompanyRef}
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

                        <div className="text-sm text-gray-500 mb-2">Drag & drop files onto any upload button, or click a button to select files.</div>

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
                                <div
                                  onDragOver={(e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; }}
                                  onDragEnter={(e) => { e.preventDefault(); dragResumeCounter.current++; setDragResume(true); }}
                                  onDragLeave={(e) => { e.preventDefault(); dragResumeCounter.current = Math.max(0, dragResumeCounter.current - 1); if (dragResumeCounter.current === 0) setDragResume(false); }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    dragResumeCounter.current = 0;
                                    setDragResume(false);
                                    if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files, 'resume');
                                  }}
                                  onClick={() => fileInputRef.current?.click()}
                                  className={`min-w-[180px] h-10 flex items-center justify-center space-x-2 px-3 rounded-md text-sm cursor-pointer ${dragResume ? 'ring-2 ring-blue-300 bg-blue-50' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'}`}
                                >
                                  <Upload className="h-4 w-4" />
                                  <span className="truncate">Upload Resume</span>
                                </div>
                              </>
                            )}
                          </div>
                          <div>
                            {!viewingId && (
                              <>
                                <input
                                  type="file"
                                  ref={coverInputRef}
                                  className="hidden"
                                  onChange={(e) => handleFileUpload(e, 'coverLetter')}
                                />
                                <div
                                  onDragOver={(e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; }}
                                  onDragEnter={(e) => { e.preventDefault(); dragCoverCounter.current++; setDragCover(true); }}
                                  onDragLeave={(e) => { e.preventDefault(); dragCoverCounter.current = Math.max(0, dragCoverCounter.current - 1); if (dragCoverCounter.current === 0) setDragCover(false); }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    dragCoverCounter.current = 0;
                                    setDragCover(false);
                                    if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files, 'coverLetter');
                                  }}
                                  onClick={() => (coverInputRef.current as HTMLInputElement)?.click()}
                                  className={`min-w-[180px] h-10 flex items-center justify-center space-x-2 px-3 rounded-md text-sm cursor-pointer ${dragCover ? 'ring-2 ring-blue-300 bg-blue-50' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'}`}
                                >
                                  <Upload className="h-4 w-4" />
                                  <span className="truncate">Upload Cover Letter</span>
                                </div>
                              </>
                            )}
                          </div>
                          <div>
                            {!viewingId && (
                              <>
                                <input
                                  type="file"
                                  ref={jobDescInputRef}
                                  className="hidden"
                                  onChange={(e) => handleFileUpload(e, 'jobDescription')}
                                />
                                <div
                                  onDragOver={(e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; }}
                                  onDragEnter={(e) => { e.preventDefault(); dragJobDescCounter.current++; setDragJobDesc(true); }}
                                  onDragLeave={(e) => { e.preventDefault(); dragJobDescCounter.current = Math.max(0, dragJobDescCounter.current - 1); if (dragJobDescCounter.current === 0) setDragJobDesc(false); }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    dragJobDescCounter.current = 0;
                                    setDragJobDesc(false);
                                    if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files, 'jobDescription');
                                  }}
                                  onClick={() => (jobDescInputRef.current as HTMLInputElement)?.click()}
                                  className={`min-w-[180px] h-10 flex items-center justify-center space-x-2 px-3 rounded-md text-sm cursor-pointer ${dragJobDesc ? 'ring-2 ring-blue-300 bg-blue-50' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'}`}
                                >
                                  <Upload className="h-4 w-4" />
                                  <span className="truncate">Upload Job Description</span>
                                </div>
                              </>
                            )}
                          </div>
                          <div>
                            {!viewingId && (
                              <>
                                <input
                                  type="file"
                                  ref={appDocInputRef}
                                  className="hidden"
                                  onChange={(e) => handleFileUpload(e, 'applicationDoc')}
                                />
                                <div
                                  onDragOver={(e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; }}
                                  onDragEnter={(e) => { e.preventDefault(); dragAppDocCounter.current++; setDragAppDoc(true); }}
                                  onDragLeave={(e) => { e.preventDefault(); dragAppDocCounter.current = Math.max(0, dragAppDocCounter.current - 1); if (dragAppDocCounter.current === 0) setDragAppDoc(false); }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    dragAppDocCounter.current = 0;
                                    setDragAppDoc(false);
                                    if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files, 'applicationDoc');
                                  }}
                                  onClick={() => (appDocInputRef.current as HTMLInputElement)?.click()}
                                  className={`min-w-[180px] h-10 flex items-center justify-center space-x-2 px-3 rounded-md text-sm cursor-pointer ${dragAppDoc ? 'ring-2 ring-blue-300 bg-blue-50' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'}`}
                                >
                                  <Upload className="h-4 w-4" />
                                  <span className="truncate">Upload Application Doc</span>
                                </div>
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
                      {editingId && (
                        <button
                          type="button"
                          onClick={() => {
                            // Open confirmation dialog for delete
                            const app = applications.find(a => a.id === editingId);
                            if (!app) return;
                            setDeleteTarget(app);
                            setConfirmOpen(true);
                          }}
                          className="px-4 py-2 border border-red-500 text-red-600 rounded-md hover:bg-red-50 cursor-pointer"
                        >
                          Delete
                        </button>
                      )}
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