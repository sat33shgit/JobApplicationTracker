import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, X, ChevronDown, ChevronUp, Edit, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';

const categories = [
  'Architecture',
  'Behavioral',
  'Communication',
  'Company Culture',
  'General',
  'Leadership',
  'Metrics and Data',
  'Operational Support',
  'Project Management',
  'Project or Team Health',
  'Problem Solving',
  'Performance Optimization',
  'Risk Management',
  'Role Specific',
  'Stakeholder Management',
  'System Design',
  'Technical',
  'Team Management',
];

// We'll load interview questions from the backend table `interview_questions` instead

// Simple in-memory cache to avoid refetching interview questions on repeated mounts
let cachedInterviewQuestions = null;

export function InterviewQuestions() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [expandedQuestions, setExpandedQuestions] = useState({});
  const [newQuestion, setNewQuestion] = useState({ question: '', answer: '', category: 'Technical', company: '' });
  const [errors, setErrors] = useState({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  const filteredQuestions = useMemo(() => questions.filter(q => {
    const searchString = `${q.question} ${q.answer} ${q.category} ${q.company || ''}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  }), [questions, searchTerm]);

  useEffect(() => {
    let mounted = true;

    const setFromRows = (rows) => {
      const normalized = (Array.isArray(rows) ? rows : []).map(r => ({ ...(r || {}), htmlAnswer: r && r.answer ? textToHtml(r.answer) : '' }));
      if (mounted) setQuestions(normalized);
    };

    if (cachedInterviewQuestions) {
      setFromRows(cachedInterviewQuestions);
      return () => { mounted = false; };
    }

    async function load() {
      try {
        const resp = await fetch('/api/interview-questions');
        if (!resp.ok) throw new Error(`Failed to load: ${resp.status}`);
        const data = await resp.json();
        cachedInterviewQuestions = Array.isArray(data) ? data : [];
        setFromRows(cachedInterviewQuestions);
      } catch (err) {
        console.error('Failed to load interview questions', err);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const groupedQuestions = useMemo(() => filteredQuestions.reduce((acc, question) => {
    if (!acc[question.category]) acc[question.category] = [];
    acc[question.category].push(question);
    return acc;
  }, {}), [filteredQuestions]);

  const toggleQuestion = (id) => setExpandedQuestions(prev => ({ ...prev, [id]: !prev[id] }));
  const expandAll = () => { const expanded = {}; filteredQuestions.forEach(q => expanded[q.id] = true); setExpandedQuestions(expanded); };
  const collapseAll = () => setExpandedQuestions({});

  const handleInputChange = (e) => { const { name, value } = e.target; setNewQuestion(prev => ({ ...prev, [name]: value })); setErrors(prev => ({ ...prev, [name]: '' })); };

  // Convert plain text (possibly Markdown-lite) to safe HTML for display.
  // We escape HTML first, then apply simple Markdown-like transformations:
  // - **bold**, *italic*, `code`
  // - paragraphs separated by blank lines, single newlines -> <br>
  const textToHtml = (raw) => {
    if (!raw && raw !== '') return '';
    // Escape HTML
    const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    let s = String(raw || '');
    s = escapeHtml(s);

    // Bold: **text**
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic: *text*
    s = s.replace(/(^|\s)\*(.+?)\*(?=\s|$)/g, (m, p1, p2) => `${p1}<em>${p2}</em>`);
    // Inline code: `code`
    s = s.replace(/`([^`]+?)`/g, '<code>$1</code>');

    // Split paragraphs on blank lines
    const paragraphs = s.split(/\n{2,}/g).map(para => {
      // replace single newlines with <br>
      const p = para.replace(/\n/g, '<br/>');
      return `<p>${p}</p>`;
    });
    return paragraphs.join('\n');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!newQuestion.question?.trim()) newErrors.question = 'Question is required';
    if (!newQuestion.answer?.trim()) newErrors.answer = 'Answer is required';
    if (!newQuestion.category) newErrors.category = 'Category is required';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    // Persist to backend
    (async () => {
      try {
        if (editingId) {
          const resp = await fetch(`/api/interview-questions/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newQuestion) });
          if (!resp.ok) throw new Error('Failed to update');
          const updated = await resp.json();
          updated.htmlAnswer = updated.answer ? textToHtml(updated.answer) : '';
          const next = questions.map(q => q.id === editingId ? updated : q);
          cachedInterviewQuestions = next;
          setQuestions(next);
          setEditingId(null);
        } else {
          const resp = await fetch('/api/interview-questions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newQuestion) });
          if (!resp.ok) throw new Error('Failed to create');
          const created = await resp.json();
          created.htmlAnswer = created.answer ? textToHtml(created.answer) : '';
          const next = [created, ...questions];
          cachedInterviewQuestions = next;
          setQuestions(next);
        }
        setNewQuestion({ question: '', answer: '', category: 'Technical', company: '' });
        setShowAddForm(false);
      } catch (err) {
        console.error('Save failed', err);
        alert('Failed to save question');
      }
    })();
  };

  const handleEdit = (id) => {
    const q = questions.find(x => x.id === id);
    if (!q) return;
    setNewQuestion({ question: q.question, answer: q.answer, category: q.category, company: q.company || '' });
    setEditingId(id);
    setShowAddForm(true);
  };

  const handleAddForCategory = (category) => {
    setEditingId(null);
    setNewQuestion({ question: '', answer: '', category: category, company: '' });
    setShowAddForm(true);
  };

  const handleDelete = (id) => { setPendingDeleteId(id); setShowDeleteModal(true); };
  const confirmDelete = async () => {
    if (pendingDeleteId == null) return;
    try {
      const resp = await fetch(`/api/interview-questions/${pendingDeleteId}`, { method: 'DELETE' });
      if (!resp.ok && resp.status !== 204) {
        let body = '';
        try { body = await resp.text(); } catch (e) { /* ignore */ }
        throw new Error(`Delete failed: ${resp.status} ${resp.statusText} ${body}`);
      }
      // refresh list from server to ensure consistent state
      try {
        const listResp = await fetch('/api/interview-questions');
        if (listResp.ok) {
          const data = await listResp.json();
          const normalized = (Array.isArray(data) ? data : []).map(r => ({ ...(r || {}), htmlAnswer: r && r.answer ? textToHtml(r.answer) : '' }));
          cachedInterviewQuestions = normalized;
          setQuestions(normalized);
        } else {
          const next = questions.filter(q => q.id !== pendingDeleteId);
          cachedInterviewQuestions = next;
          setQuestions(next);
        }
      } catch (e) {
        const next = questions.filter(q => q.id !== pendingDeleteId);
        cachedInterviewQuestions = next;
        setQuestions(next);
      }
      setExpandedQuestions(prev => { const updated = { ...prev }; delete updated[pendingDeleteId]; return updated; });
      setPendingDeleteId(null);
      setShowDeleteModal(false);
    } catch (err) {
      console.error('Delete failed', err);
      alert('Failed to delete question: ' + (err && err.message ? err.message : 'unknown error'));
    }
  };
  const cancelDelete = () => { setPendingDeleteId(null); setShowDeleteModal(false); };

  return (
    <div className="space-y-6">
      
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Interview Questions and Answers</h2>
          <br></br>
          <div className="mb-6 px-6 mt-4">
            <div className="flex items-center space-x-2">
              <div className="relative w-full md:w-3/4 min-w-0">
                <input
                  type="text"
                  placeholder="Search questions and answers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border rounded-md w-full"
                />
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>

              <button
                onClick={() => setSearchTerm('')}
                className="text-sm px-3 py-2 bg-white border rounded-md text-gray-700 hover:bg-gray-50 cursor-pointer"
                aria-label="Clear search"
              >
                Clear
              </button>

              <div>
                <button onClick={() => { setShowAddForm(true); setEditingId(null); setNewQuestion({ question: '', answer: '', category: 'Technical', company: '' }); }} className="cursor-pointer flex items-center justify-center space-x-3 bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 whitespace-nowrap"><Plus className="h-5 w-5" /><span>Add Question</span></button>
              </div>
            </div>
          </div>
        </div>

        {filteredQuestions.length > 0 && (
          <div className="mb-4 flex justify-between items-center">
            <div className="text-md font-semibold text-gray-600">Showing {filteredQuestions.length} question{filteredQuestions.length !== 1 ? 's' : ''}</div>
            <div className="flex space-x-2"><button onClick={expandAll} className="cursor-pointer text-sm text-blue-600 hover:text-blue-800">Expand All</button><span className="text-gray-300">|</span><button onClick={collapseAll} className="cursor-pointer text-sm text-blue-600 hover:text-blue-800">Collapse All</button></div>
          </div>
        )}

        {filteredQuestions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">{searchTerm ? 'No questions found matching your search.' : 'No questions yet. Add your first question!'}</div>
        ) : (
          <div className="space-y-6">
            {Object.keys(groupedQuestions).sort().map(category => (
              <div key={category}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-900">{category}</h3>
                            <div className="ml-4">
                              <button type="button" onClick={() => handleAddForCategory(category)} className="cursor-pointer text-sm bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 mb-3">Add</button>
                            </div>
                    </div>
                <div className="space-y-2">
                  {groupedQuestions[category].map(question => (
                    <motion.div key={question.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border border-gray-200 rounded-lg hover:shadow-md transition-shadow overflow-visible">
                              <div className="bg-gray-50 rounded-t-lg px-4 py-3 cursor-pointer flex justify-between items-center hover:bg-gray-100" onClick={() => toggleQuestion(question.id)}>
                              <div className="flex items-center space-x-3 flex-1 pl-2">
                                {expandedQuestions[question.id] ? <ChevronUp className="h-5 w-5 text-gray-500 flex-shrink-0"/> : <ChevronDown className="h-5 w-5 text-gray-500 flex-shrink-0"/>}
                                <div className="min-w-0">
                                  <div className="font-medium text-gray-900 truncate">{question.question}</div>
                                  {question.company ? <div className="text-sm text-gray-500 truncate">{question.company}</div> : null}
                                </div>
                              </div>
                        <div className="flex items-center space-x-2 ml-4" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => handleEdit(question.id)} className="cursor-pointer p-1 text-blue-600 hover:bg-blue-50 rounded" title="Edit question"><Edit className="h-4 w-4"/></button>
                          <button onClick={() => handleDelete(question.id)} className="cursor-pointer p-1 text-red-600 hover:bg-red-50 rounded" title="Delete question"><Trash2 className="h-4 w-4"/></button>
                        </div>
                      </div>

                      {expandedQuestions[question.id] && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="bg-white px-4 py-4 border-t border-gray-200 rounded-b-lg">
                          <div className="text-gray-700" dangerouslySetInnerHTML={{ __html: question.htmlAnswer || textToHtml(question.answer) }} />
                        </motion.div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

      {showAddForm && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50 bg-black/10" style={{ backdropFilter: 'blur(6px)' }}>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-lg shadow-xl mx-auto overflow-y-auto" style={{ width: '33vw', minWidth: '360px', maxWidth: '900px', maxHeight: '90vh' }}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">{editingId ? 'Edit Question' : 'Add New Question and Answer'}</h2>
                <button onClick={() => { setShowAddForm(false); setEditingId(null); setNewQuestion({ question: '', answer: '', category: 'Technical', company: '' }); setErrors({}); }} className="cursor-pointer text-gray-500 hover:text-gray-700"><X className="h-6 w-6"/></button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <select name="category" value={newQuestion.category} onChange={handleInputChange} className={`w-full border rounded-md px-3 py-2 ${errors.category ? 'border-red-500' : ''}`}>
                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                  {errors.category && <p className="text-red-500 text-sm mt-1">{errors.category}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company (optional)</label>
                  <input name="company" value={newQuestion.company} onChange={handleInputChange} placeholder="Company name (optional)" className="w-full border rounded-md px-3 py-2" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Question *</label>
                  <textarea name="question" value={newQuestion.question} onChange={handleInputChange} rows={3} placeholder="Enter your interview question..." className={`w-full border rounded-md px-3 py-2 ${errors.question ? 'border-red-500' : ''}`}/>
                  {errors.question && <p className="text-red-500 text-sm mt-1">{errors.question}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Answer *</label>
                  <textarea name="answer" value={newQuestion.answer} onChange={handleInputChange} rows={6} placeholder="Enter your prepared answer..." className={`w-full border rounded-md px-3 py-2 ${errors.answer ? 'border-red-500' : ''}`}/>
                  {errors.answer && <p className="text-red-500 text-sm mt-1">{errors.answer}</p>}
                </div>

                <div className="flex justify-end space-x-6 pt-4">
                  <button type="button" onClick={() => { setShowAddForm(false); setEditingId(null); setNewQuestion({ question: '', answer: '', category: 'Technical', company: '' }); setErrors({}); }} className="cursor-pointer px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
                  <button type="submit" className="cursor-pointer px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">{editingId ? 'Update Question' : 'Add Question'}</button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 flex items-center justify-center p-6 z-50 bg-black/20" style={{ backdropFilter: 'blur(6px)' }}>
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-lg shadow-xl mx-auto border" style={{ width: '33vw', minWidth: '360px', maxWidth: '900px' }}>
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-2">Delete Question</h3>
              <p className="text-sm text-gray-600 mb-4">Are you sure you want to delete this question? This will remove the question from your saved list.</p>

              {pendingDeleteId != null && (
                <div className="mb-4 p-3 bg-gray-50 rounded text-sm text-gray-800 font-medium">{questions.find(q => q.id === pendingDeleteId)?.question}</div>
              )}

              <div className="border-t border-gray-200 mt-4 pt-4 flex justify-end items-center gap-3">
                <button onClick={cancelDelete} className="cursor-pointer px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 bg-white">Cancel</button>
                <button onClick={confirmDelete} className="cursor-pointer px-4 py-2 border border-red-600 text-red-600 rounded-md hover:bg-red-50 bg-white">Delete</button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
