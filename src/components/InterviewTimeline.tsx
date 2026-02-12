import React, { useState } from 'react';
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

const mockInterviewData: InterviewResponse[] = [
  {
    id: 1,
    companyName: "BC Pension Corporation",
    role: "Delivery Lead",
    dateOfInterview: "2024-04-08",
    hrPerson: {
      name: "Conner, Simone",
      email: "simone.conner@pensionsbc.ca"
    },
    otherDetails: "Interview over teams was conducted. A PPT was presented by me, a predefined questions were answered. Interview done with Zac for the Program Manager role. However, my profile doesn't suit well for the role. Zac recommended for another role but my skills are not matching well for it.",
    status: "completed"
  },
  {
    id: 2,
    companyName: "Santuary AI",
    role: "Program Manager, Robot Fleet Deployment Technology Program",
    dateOfInterview: "2024-06-10",
    hrPerson: {
      name: "Zac Engler",
      email: "zac@sanctuary.ai"
    },
    otherDetails: "",
    status: "completed"
  },
  {
    id: 3,
    companyName: "BCLC",
    role: "Manager",
    dateOfInterview: "2024-07-19",
    hrPerson: {
      name: "Jennifer Dollard",
      email: "jdollard@bclc.com"
    },
    otherDetails: "Telephonic interview was scheduled on 1st Aug at 3pm.",
    status: "completed"
  },
  {
    id: 4,
    companyName: "Connor, Clark & Lunn Financial Group Ltd.",
    role: "Manager, Software Development, Portfolio Administration",
    dateOfInterview: "2024-09-09",
    hrPerson: {
      name: "Ro Dalipaj",
      email: ""
    },
    otherDetails: "Initial HR interview was done. Email sent by Helmut to confirm on the salary. Their max salary range is $125k",
    status: "completed"
  },
  {
    id: 5,
    companyName: "Trail Appliances",
    role: "Sr. Technical Project Manager, Software Development",
    dateOfInterview: "2024-10-05",
    hrPerson: {
      name: "Helmut Hager",
      email: "hhager@trailappliances.com"
    },
    otherDetails: "",
    status: "completed"
  },
  {
    id: 6,
    companyName: "SSI Ship Constructor",
    role: "Manager",
    dateOfInterview: "2024-10-18",
    hrPerson: {
      name: "Soleia Zotzman",
      email: "notifications@app.bamboohr.com"
    },
    otherDetails: "Did not proceed ahead for 2nd round",
    status: "completed"
  },
  {
    id: 7,
    companyName: "Kainos, Halifax",
    role: "Delivery Manager",
    dateOfInterview: "2025-04-23",
    hrPerson: {
      name: "Jonathan Menard",
      email: "jonathan.menard@kainos.com"
    },
    otherDetails: "Did not proceed ahead after the preliminary round. Requested for $170k salary.",
    status: "scheduled"
  },
  {
    id: 8,
    companyName: "VYR Authority",
    role: "Manager",
    dateOfInterview: "2025-06-05",
    hrPerson: {
      name: "Janice Wong",
      email: "janice_wong@vyr.ca"
    },
    otherDetails: "Screening interview done by Punita Jain. Requested salary range from 100k to 149k. Around 40mins of Google meet interview.",
    status: "scheduled"
  },
  {
    id: 9,
    companyName: "Microsoft Canada",
    role: "Senior Software Engineer",
    dateOfInterview: "2025-08-15",
    hrPerson: {
      name: "Sarah Mitchell",
      email: "sarah.mitchell@microsoft.com"
    },
    otherDetails: "First round technical interview. Discussed system design and algorithms. Panel of 3 engineers. Very positive feedback received. Moving to next round.",
    status: "scheduled"
  },
  {
    id: 10,
    companyName: "Microsoft Canada",
    role: "Engineering Manager",
    dateOfInterview: "2025-09-22",
    hrPerson: {
      name: "David Chen",
      email: "david.chen@microsoft.com"
    },
    otherDetails: "Leadership interview for Engineering Manager position. Discussed team management experience, project delivery, and stakeholder management. Different team than the Senior Engineer role. Waiting for feedback.",
    status: "scheduled"
  },
  {
    id: 11,
    companyName: "LAC",
    role: "Systems Engineering and Enablement Leader",
    dateOfInterview: "2025-11-27",
    hrPerson: {
      name: "Ted McLeod / Alanna Dare Gammage",
      email: "ted.mcleod@landadmin.com"
    },
    otherDetails: "I was the first person to be interviewed for this role. They need this person to be ready by 1st Jan. Will contact me further after discussing internally. Preliminary Call. Asked around 10 questions. The interview notes will be shared with the team for further review and will get back to me further",
    status: "scheduled"
  },
  {
    id: 12,
    companyName: "Amazon Web Services",
    role: "Cloud Solutions Architect",
    dateOfInterview: "2025-12-10",
    hrPerson: {
      name: "Emily Rodriguez",
      email: "emilyr@amazon.com"
    },
    otherDetails: "Initial screening call went very well. Discussed cloud architecture experience with Azure and AWS. They're particularly interested in my multi-cloud expertise. Technical deep dive scheduled for next week.",
    status: "scheduled"
  },
  {
    id: 13,
    companyName: "Amazon Web Services",
    role: "DevOps Engineering Manager",
    dateOfInterview: "2025-12-18",
    hrPerson: {
      name: "Michael Patterson",
      email: "mpatterson@amazon.com"
    },
    otherDetails: "Different team within AWS focusing on DevOps and CI/CD pipelines. This is for their Vancouver office. Salary range discussed: $145k-$175k. Very interested in my leadership experience with distributed teams.",
    status: "scheduled"
  },
  {
    id: 14,
    companyName: "LawDepot",
    role: "Front End Development Manager",
    dateOfInterview: "2025-11-28",
    hrPerson: {
      name: "Jesse Thomson",
      email: ""
    },
    otherDetails: "",
    status: "scheduled"
  }
];

const formatDisplayDate = (isoDate: string) => {
  const date = new Date(isoDate);
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
};

const getMonthYear = (isoDate: string) => {
  const date = new Date(isoDate);
  const month = date.toLocaleString('en-US', { month: 'short' });
  const year = date.getFullYear();
  return `${month} ${year}`;
};

export function InterviewTimeline() {
  const [selectedInterview, setSelectedInterview] = useState<InterviewResponse | null>(mockInterviewData[0]);
  const [viewMode, setViewMode] = useState<'timeline' | 'list'>('timeline');

  // Group interviews by month/year
  const groupedInterviews = mockInterviewData.reduce((acc, interview) => {
    const monthYear = getMonthYear(interview.dateOfInterview);
    if (!acc[monthYear]) {
      acc[monthYear] = [];
    }
    acc[monthYear].push(interview);
    return acc;
  }, {} as Record<string, InterviewResponse[]>);

  // Count interviews per company
  const companyInterviewCount = mockInterviewData.reduce((acc, interview) => {
    acc[interview.companyName] = (acc[interview.companyName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Get all interviews for the selected company
  const relatedInterviews = selectedInterview 
    ? mockInterviewData.filter(i => i.companyName === selectedInterview.companyName)
    : [];

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

      {viewMode === 'timeline' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Timeline Sidebar */}
          <div className="lg:col-span-1 bg-white rounded-lg shadow-md border border-gray-200 p-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 sticky top-0 bg-white pb-2">
              Interview Timeline
            </h3>
            <div className="space-y-6">
              {Object.entries(groupedInterviews).map(([monthYear, interviews]) => (
                <div key={monthYear}>
                  <div className="flex items-center mb-4">
                    <div className="flex-1 border-t border-gray-200" />
                    <div className="px-4 text-sm font-semibold text-gray-500 uppercase tracking-wider">{monthYear}</div>
                    <div className="flex-1 border-t border-gray-200" />
                  </div>
                  <div className="space-y-2 relative pl-6 border-l-2 border-gray-200 ml-1">
                    {interviews.map((interview) => (
                      <motion.button
                        key={interview.id}
                        onClick={() => setSelectedInterview(interview)}
                        className={`w-full text-left p-3 rounded-lg transition-all relative ${
                          selectedInterview?.id === interview.id
                            ? 'bg-blue-50 border-2 border-blue-500 shadow-sm'
                            : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                        }`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {/* Timeline dot */}
                        <div
                          className={`absolute -left-[17px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 ${
                            selectedInterview?.id === interview.id
                              ? 'bg-blue-600 border-blue-600'
                              : 'bg-white border-gray-300'
                          }`}
                        />
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900 text-sm truncate">
                              {interview.companyName}
                            </h4>
                            <p className="text-xs text-gray-600 mt-0.5 line-clamp-1">
                              {interview.role}
                            </p>
                            <div className="flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3 text-gray-400" />
                              <span className="text-xs text-gray-500">
                                {formatDisplayDate(interview.dateOfInterview)}
                              </span>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                              interview.status === 'completed'
                                ? 'bg-green-100 text-green-700'
                                : interview.status === 'scheduled'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {interview.status === 'completed' ? 'Done' : 'Upcoming'}
                          </span>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>
              ))}
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
                    <div className="flex items-start justify-between gap-4">
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
                      <span
                        className={`px-3 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap ${
                          selectedInterview.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : selectedInterview.status === 'scheduled'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {selectedInterview.status === 'completed' ? 'Completed' : 'Scheduled'}
                      </span>
                    </div>
                  </div>

                  {/* Interview Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Date of Interview */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Calendar className="w-4 h-4 text-blue-600" />
                        </div>
                        <h4 className="font-semibold text-gray-900">Date of Interview</h4>
                      </div>
                      <p className="text-gray-700 text-lg font-medium ml-10">
                        {selectedInterview.dateOfInterview ? formatDisplayDate(selectedInterview.dateOfInterview) : 'N/A'}
                      </p>
                    </div>

                    {/* HR Contact */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                          <User className="w-4 h-4 text-purple-600" />
                        </div>
                        <h4 className="font-semibold text-gray-900">HR Contact</h4>
                      </div>
                      <div className="ml-10">
                        <p className="text-gray-900 font-medium">
                          {selectedInterview.hrPerson.name}
                        </p>
                        {selectedInterview.hrPerson.email && (
                          <div className="flex items-center gap-1 mt-1">
                            <Mail className="w-3 h-3 text-gray-400" />
                            <a
                              href={`mailto:${selectedInterview.hrPerson.email}`}
                              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {selectedInterview.hrPerson.email}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Other Details */}
                  {selectedInterview.otherDetails && (
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-6">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                          <MessageSquare className="w-4 h-4 text-green-600" />
                        </div>
                        <h4 className="font-semibold text-gray-900">Interview Notes & Details</h4>
                      </div>
                      <div className="ml-10">
                        <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                          {selectedInterview.otherDetails}
                        </p>
                      </div>
                    </div>
                  )}

                  {!selectedInterview.otherDetails && (
                    <div className="bg-gray-50 rounded-lg p-6 text-center">
                      <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">No additional details available</p>
                    </div>
                  )}

                  {/* Related Interviews from Same Company */}
                  {relatedInterviews.length > 1 && (
                    <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-amber-600" />
                        </div>
                        <h4 className="font-semibold text-gray-900">
                          Multiple Roles at {selectedInterview.companyName}
                        </h4>
                        <span className="ml-auto px-2 py-1 bg-amber-200 text-amber-800 text-xs font-semibold rounded-full">
                          {relatedInterviews.length} interviews
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mb-4 ml-10">
                        You have interviewed for {relatedInterviews.length} different positions at this company
                      </p>
                      <div className="ml-10 space-y-3">
                        {relatedInterviews.map((related) => (
                          <div
                            key={related.id}
                            className={`p-4 rounded-lg transition-all cursor-pointer ${
                              related.id === selectedInterview.id
                                ? 'bg-white border-2 border-amber-400 shadow-sm'
                                : 'bg-white/50 border border-amber-200 hover:bg-white hover:border-amber-300'
                            }`}
                            onClick={() => setSelectedInterview(related)}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <h5 className="font-semibold text-gray-900 mb-1">{related.role}</h5>
                                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                                  <div className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    <span>{formatDisplayDate(related.dateOfInterview)}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    <span>{related.hrPerson.name}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                                    related.status === 'completed'
                                      ? 'bg-green-100 text-green-700'
                                      : related.status === 'scheduled'
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-yellow-100 text-yellow-700'
                                  }`}
                                >
                                  {related.status === 'completed' ? 'Completed' : 'Scheduled'}
                                </span>
                                {related.id === selectedInterview.id && (
                                  <span className="text-xs text-amber-600 font-medium">Currently Viewing</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Interview Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    HR Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {mockInterviewData.map((interview) => (
                  <tr key={interview.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{interview.companyName}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-700 max-w-xs">{interview.role}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-700">
                        {formatDisplayDate(interview.dateOfInterview)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{interview.hrPerson.name}</div>
                      {interview.hrPerson.email && (
                        <div className="text-xs text-gray-500">{interview.hrPerson.email}</div>
                      )}
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
                        {interview.status === 'completed' ? 'Completed' : 'Scheduled'}
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

      {/* Statistics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Total Interviews</p>
              <p className="text-3xl font-bold text-gray-900">{mockInterviewData.length}</p>
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
                {mockInterviewData.filter((i) => i.status === 'completed').length}
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
                {mockInterviewData.filter((i) => i.status === 'scheduled').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}