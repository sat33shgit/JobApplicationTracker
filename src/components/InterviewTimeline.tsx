import React, { useState, useEffect } from 'react';
import { Calendar, Mail, User, FileText, ChevronRight, Building2, Clock, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface InterviewResponse {
  id: number;
  companyName: string;
  role: string;
  dateOfInterview: string;
  hrPerson: {
    name: string;
    email: string;
  };
  otherDetails: string;
  status: 'scheduled' | 'completed' | 'pending';
}

/* mockInterviewData removed - component starts with empty list and loads real data from /api/jobs */

// Parse a YYYY-MM-DD string into a local Date (avoids timezone shifts)
const parseLocalYMD = (s?: string) => {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10) - 1;
    const d = parseInt(m[3], 10);
    return new Date(y, mo, d);
  }
  // fallback to Date constructor for other formats
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
};

const formatDisplayDate = (isoDate: string) => {
  const date = parseLocalYMD(isoDate) || new Date(isoDate);
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
};

const getMonthYear = (isoDate: string) => {
  const date = parseLocalYMD(isoDate) || new Date(isoDate);
  const month = date.toLocaleString('en-US', { month: 'short' });
  const year = date.getFullYear();
  return `${month} ${year}`;
};

export function InterviewTimeline({ applications, companies }: { applications?: any[]; companies?: { id: number; name: string }[] }) {
  // Ignore `applications` prop for the interviews page and always fetch tracked jobs (track === 't').
  // Start with mock data until the tracked jobs are loaded.
  // start with empty list; we'll populate from the API
  const [data, setData] = useState<any[]>([]);
  const [selectedInterview, setSelectedInterview] = useState<any | null>(null);

  // Load jobs directly and keep only rows where `track === 't'` (string 't').
  useEffect(() => {
    let mounted = true;
    async function loadTrackedJobs() {
      try {
        const resp = await fetch('/api/jobs');
        if (!resp.ok) return;
        const rows = await resp.json();
        const filtered = rows.filter((r: any) => {
          if (!r) return false;
          // Accept string 't', boolean true, or string 'true' (case-insensitive)
          const v = r.track;
          return v === 't' || v === 'T' || v === true || (typeof v === 'string' && v.toLowerCase() === 'true');
        });
        const mapped = filtered.map((r: any) => {
          const applied = r.applied_date || r.dateApplied || '';
          const appliedIso = applied ? new Date(applied).toISOString().slice(0,10) : '';
          const appliedTs = applied ? new Date((appliedIso) + 'T00:00:00').getTime() : 0;
          return {
            id: r.id,
            companyName: r.company || 'Unknown',
            role: r.title || r.role || '',
            submissionDate: appliedIso,
            submissionTs: r.dateAppliedTs || (parseLocalYMD(appliedIso) || new Date(appliedIso)).getTime(),
            interviewDate: r.interview_date ? (r.interview_date.slice ? r.interview_date.slice(0,10) : r.interview_date) : (r.dateOfInterview || ''),
            contacts: r.contacts || r.metadata?.contacts || [],
            status: typeof r.status === 'string' ? (r.status.charAt(0).toUpperCase() + r.status.slice(1)) : (r.status || 'Applied'),
            statusHistory: r.status_notes || r.statusNotes || '',
            hrPerson: (r.contacts && r.contacts[0]) || { name: '', email: '' }
          };
        });
        if (mounted) {
          if (mapped.length > 0) {
            setData(mapped);
            setSelectedInterview(mapped[0]);
          } else {
            // No tracked rows — show empty list
            setData([]);
            setSelectedInterview(null);
          }
        }
      } catch (e) {
        // ignore errors and keep mock data
      }
    }
    loadTrackedJobs();
    return () => { mounted = false; };
  }, []);
  const [viewMode, setViewMode] = useState<'timeline' | 'list'>('timeline');

  // List view sorting state
  const [sortKey, setSortKey] = useState<'companyName' | 'role' | 'interviewDate' | 'submissionDate' | 'status'>('submissionDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const appsSorted = data.slice().sort((a, b) => {
    const getVal = (item: any) => {
      switch (sortKey) {
        case 'companyName':
          return String(item.companyName || '').toLowerCase();
        case 'role':
          return String(item.role || '').toLowerCase();
        case 'interviewDate':
          return (parseLocalYMD(item.interviewDate)?.getTime() || 0);
        case 'submissionDate':
          return Number(item.submissionTs || 0) || (parseLocalYMD(item.submissionDate)?.getTime() || 0);
        case 'status':
          return String(item.status || '').toLowerCase();
        default:
          return '';
      }
    };

    const va = getVal(a);
    const vb = getVal(b);
    let cmp = 0;
    if (typeof va === 'number' && typeof vb === 'number') cmp = (va as number) - (vb as number);
    else cmp = String(va).localeCompare(String(vb));
    return sortDir === 'asc' ? cmp : -cmp;
  });

  // (removed unused grouping and related-interviews helpers during cleanup)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Interview Responses</h2>
          <p className="text-sm text-gray-600 mt-1">Track companies that responded and scheduled interviews</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('timeline')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              viewMode === 'timeline'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Timeline
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              viewMode === 'list'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            List
          </button>
        </div>
      </div>

      {/* Statistics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Total Interviews</p>
              <p className="text-3xl font-bold text-gray-900">{data.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Completed</p>
              <p className="text-3xl font-bold text-gray-900">
                {data.filter((i) => String(i.status).toLowerCase() === 'completed').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Upcoming</p>
              <p className="text-3xl font-bold text-gray-900">
                {data.filter((i) => String(i.status).toLowerCase().includes('sched')).length}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {viewMode === 'timeline' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Timeline Sidebar */}
          <div className="lg:col-span-1 bg-white rounded-lg shadow-md border border-gray-200 p-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 sticky top-0 bg-white pb-2">
              Interview Timeline
            </h3>
            <div className="space-y-2">
              {appsSorted.map((item) => {
                const dateSource = item.submissionDate || item.interviewDate || '';
                const monthYear = dateSource ? getMonthYear(dateSource) : '';
                return (
                  <motion.button
                    key={item.id}
                    onClick={() => setSelectedInterview(item)}
                    className={`w-full text-left p-3 pl-6 rounded-lg transition-all relative ${
                      selectedInterview?.id === item.id
                        ? 'bg-blue-50 border-2 border-blue-500 shadow-sm'
                        : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {/* Centered month/year separator inside the item */}
                    {monthYear && (
                      <div className="flex items-center justify-center mb-2">
                        <div className="border-t border-gray-200 flex-1 mr-2" />
                        <div className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-white">{monthYear}</div>
                        <div className="border-t border-gray-200 flex-1 ml-2" />
                      </div>
                    )}

                    <div className={`absolute -left-[17px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 ${
                      selectedInterview?.id === item.id ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'
                    }`} />
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 text-sm truncate">{item.companyName}</h4>
                        <p className="text-xs text-gray-600 mt-0.5 line-clamp-1">{item.role}</p>
                        <div className="flex items-center gap-1 mt-1">
                                                    <span className="text-xs text-gray-500 mr-1"> Submission Date: </span>
                          <span className="text-xs text-gray-500">{dateSource ? formatDisplayDate(dateSource) : 'N/A'}</span>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                        item.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : item.status === 'scheduled' || item.status.toLowerCase().includes('sched')
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}> {item.status} </span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Details Panel */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {selectedInterview && (
                <motion.div
                  key={selectedInterview.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                  className="bg-white rounded-lg shadow-md border border-gray-200 p-6"
                >
                  {/* Company Header */}
                  <div className="border-b border-gray-200 pb-4 mb-6">
                    <div className="flex items-start gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-2xl font-bold text-gray-900">
                            {selectedInterview.companyName}
                          </h3>
                          <p className="text-gray-600 mt-1">{selectedInterview.role}</p>
                        </div>
                      </div>
                      {/* Compact status badge at top-right */}
                      <span className={`ml-auto self-start px-3 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap ${
                        String(selectedInterview.status).toLowerCase() === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : String(selectedInterview.status).toLowerCase().includes('sched')
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {selectedInterview?.status ? String(selectedInterview.status) : 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Interview Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    {/* Submission Date */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center mb-2">
                        <div className="w-8 h-8 flex items-center justify-center">
                          <Calendar className="w-4 h-4 text-blue-600" />
                        </div>
                        <h4 className="font-semibold text-gray-900">Submission Date</h4>
                      </div>
                      <p className="text-gray-700 text-lg font-medium">
                        {selectedInterview?.submissionDate ? formatDisplayDate(selectedInterview.submissionDate) : 'N/A'}
                      </p>
                    </div>

                    {/* Date of Interview */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center mb-2">
                        <div className="w-8 h-8 flex items-center justify-center">
                          <Calendar className="w-4 h-4 text-blue-600" />
                        </div>
                        <h4 className="font-semibold text-gray-900">Interview Date</h4>
                      </div>
                      <p className="text-gray-700 text-lg font-medium">
                        {selectedInterview.interviewDate ? formatDisplayDate(selectedInterview.interviewDate) : 'N/A'}
                      </p>
                    </div>

                    {/* HR Contact */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center mb-2">
                        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                          <User className="w-4 h-4 text-purple-600" />
                        </div>
                        <h4 className="font-semibold text-gray-900">HR Contact</h4>
                      </div>
                      <div className="ml-10">
                        {(() => {
                          const primary = selectedInterview.contacts && selectedInterview.contacts.length > 0
                            ? selectedInterview.contacts[0]
                            : (selectedInterview.hrPerson || { name: '', email: '' });
                          return (
                            <>
                              <p className="text-gray-900 font-medium">{primary?.name || 'N/A'}</p>
                              {primary?.email && (
                                <div className="flex items-center gap-2 mt-1">
                                  <Mail className="w-3 h-3 text-gray-400" />
                                  <a href={`mailto:${primary.email}`} className="text-sm text-blue-600 hover:text-blue-800 hover:underline mr-2">{primary.email}</a>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    
                  </div>

                  {/* Interview Notes & Details (read-only textarea like Status History) */}
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-1">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                        <MessageSquare className="w-4 h-4 text-green-600" />
                      </div>
                      <h4 className="font-semibold text-gray-900">Interview Notes & Details</h4>
                    </div>
                    <div className="ml-10">
                      <textarea
                        name="interviewNotes"
                        value={String(selectedInterview?.otherDetails || selectedInterview?.statusHistory || '').replace(/^\s*-{3,}\s*$/gm, '------------------------------------------')}
                        readOnly
                        rows={6}
                        wrap="soft"
                        style={{ whiteSpace: 'pre-wrap' }}
                        className="w-full border rounded-md px-3 py-2 h-40 bg-gray-50 text-sm text-gray-700 resize-none overflow-y-auto"
                      />
                    </div>
                  </div>

                  
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        /* List View */
        <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    onClick={() => toggleSort('companyName')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                  >
                    COMPANY
                    {sortKey === 'companyName' && <span className="ml-2 text-xs">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ROLE
                    {sortKey === 'role' && <span className="ml-2 text-xs">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button type="button" onClick={() => toggleSort('interviewDate')} className="inline-flex items-center gap-2 cursor-pointer">
                      INTERVIEW DATE
                      {sortKey === 'interviewDate' && <span className="ml-2 text-xs">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button type="button" onClick={() => toggleSort('submissionDate')} className="inline-flex items-center gap-2 cursor-pointer">
                      SUBMISSION DATE
                      {sortKey === 'submissionDate' && <span className="ml-2 text-xs">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button type="button" onClick={() => toggleSort('status')} className="inline-flex items-center gap-2 cursor-pointer">
                      STATUS
                      {sortKey === 'status' && <span className="ml-2 text-xs">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {appsSorted.map((interview) => (
                  <tr key={interview.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{interview.companyName}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-700 max-w-xs">{interview.role}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-700">
                        {interview.interviewDate ? formatDisplayDate(interview.interviewDate) : 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-700">{interview.submissionDate ? formatDisplayDate(interview.submissionDate) : 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          interview.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : interview.status === 'scheduled'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {interview.status === 'completed' ? 'Completed' : interview.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => {
                          setSelectedInterview(interview);
                          setViewMode('timeline');
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
                      >
                        View Details
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>

  );
}