/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Image as ImageIcon,
  RotateCcw,
} from 'lucide-react';
import {
  VERIFICATION_CONFIG,
  verifyParticipantEligibility,
} from './config/approvedParticipants';
import {
  downloadCanvasAsPdf,
  downloadCanvasAsPng,
  renderParticipationCertificate,
} from './utils/certificateCanvas';

const DEPARTMENT_OPTIONS = [
  'CSE',
  'IT',
  'AI & DS',
  'AI & ML',
  'ECE',
  'EEE',
  'Mechanical',
  'Civil',
  'Chemical',
  'Other',
] as const;

type DepartmentOption = (typeof DEPARTMENT_OPTIONS)[number];

interface CertificateData {
  fullName: string;
  department: string;
  email: string;
}

export default function App() {
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState<DepartmentOption | ''>('');
  const [customDepartment, setCustomDepartment] = useState('');
  const [email, setEmail] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [generatedData, setGeneratedData] = useState<CertificateData | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isDownloadingPng, setIsDownloadingPng] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const resolvedDepartment =
    department === 'Other'
      ? customDepartment.trim() || 'Other'
      : department;

  useEffect(() => {
    if (!generatedData) return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    setIsRendering(true);
    setRenderError(null);

    renderParticipationCertificate(
      canvas,
      generatedData.fullName,
      generatedData.department
    )
      .then(() => {
        if (!cancelled) setIsRendering(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setIsRendering(false);
          setRenderError(
            err instanceof Error
              ? err.message
              : 'Unable to generate certificate preview.'
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [generatedData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    if (trimmedName.length < 2) {
      setFormError('Please enter your full name as it should appear on the certificate.');
      return;
    }

    if (!department) {
      setFormError('Please select your department from the dropdown.');
      return;
    }

    if (department === 'Other' && !customDepartment.trim()) {
      setFormError('Please specify your department name.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setFormError('Please enter a valid email address.');
      return;
    }

    if (!confirmed) {
      setFormError('Please confirm that your details are accurate before generating.');
      return;
    }

    const verification = verifyParticipantEligibility(trimmedName, trimmedEmail);
    if (!verification.verified) {
      setFormError(
        verification.errorMessage ?? 'Participant verification failed.'
      );
      return;
    }

    setGeneratedData({
      fullName: trimmedName,
      department: resolvedDepartment,
      email: trimmedEmail,
    });
  };

  const handleDownloadPng = async () => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !generatedData) return;
    setIsDownloadingPng(true);
    try {
      await downloadCanvasAsPng(canvas, generatedData.fullName);
    } finally {
      setIsDownloadingPng(false);
    }
  };

  const handleDownloadPdf = () => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !generatedData) return;
    setIsDownloadingPdf(true);
    try {
      downloadCanvasAsPdf(canvas, generatedData.fullName);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleGenerateAgain = () => {
    setGeneratedData(null);
    setRenderError(null);
    setFormError(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FBF9F5] text-slate-900">
      {/* Institutional Header */}
      <header className="border-b border-stone-200 bg-white">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between gap-6">
          <span className="font-editorial text-base sm:text-lg font-bold text-slate-900 whitespace-nowrap shrink-0">
            St. Joseph&apos;s College of Engineering
          </span>

          <nav
            aria-label="Event context"
            className="hidden sm:flex items-center gap-4 text-xs font-medium text-slate-600"
          >
            <span className="whitespace-nowrap">Students&apos; Council</span>
            <span aria-hidden="true" className="text-stone-300">
              /
            </span>
            <span className="whitespace-nowrap">STARTATHON 2026</span>
          </nav>

          <span className="text-xs font-medium text-slate-600 whitespace-nowrap shrink-0">
            25.09.2026
          </span>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-5 sm:px-8 py-8 sm:py-12">
        {!generatedData ? (
          <div className="max-w-xl mx-auto">
            {/* Editorial Title Block */}
            <div className="mb-8 text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-900 mb-2">
                Students&apos; Council · Official Participation Portal
              </p>
              <h1 className="font-editorial text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight text-balance">
                STARTATHON 2026 Participation Certificate
              </h1>
              <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
                Enter your details below to generate, preview, and download your official participation certificate in PDF or PNG format.
              </p>
            </div>

            {/* Student Details Form */}
            <form
              onSubmit={handleSubmit}
              noValidate
              className="bg-white border border-stone-200 rounded-xl p-6 sm:p-8 flex flex-col gap-5"
            >
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="student-full-name"
                  className="text-sm font-medium text-slate-800"
                >
                  Full Name
                </label>
                <input
                  id="student-full-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  placeholder="Enter your full name (e.g. Aarav Subramanian)"
                  className="w-full min-h-[42px] px-3.5 py-2.5 text-sm bg-white border border-stone-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="student-department"
                  className="text-sm font-medium text-slate-800"
                >
                  Department
                </label>
                <select
                  id="student-department"
                  required
                  value={department}
                  onChange={(e) => {
                    setDepartment(e.target.value as DepartmentOption | '');
                    if (formError) setFormError(null);
                  }}
                  className="w-full min-h-[42px] px-3.5 py-2.5 text-sm bg-white border border-stone-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
                >
                  <option value="">Select your department</option>
                  {DEPARTMENT_OPTIONS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {department === 'Other' && (
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="student-custom-department"
                    className="text-sm font-medium text-slate-800"
                  >
                    Specify Department Name
                  </label>
                  <input
                    id="student-custom-department"
                    type="text"
                    required
                    value={customDepartment}
                    onChange={(e) => {
                      setCustomDepartment(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    placeholder="e.g. Biotechnology, CSBS, Mechatronics"
                    className="w-full min-h-[42px] px-3.5 py-2.5 text-sm bg-white border border-stone-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
                  />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="student-email"
                  className="text-sm font-medium text-slate-800"
                >
                  Email Address
                </label>
                <input
                  id="student-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  placeholder="Enter your email address"
                  className="w-full min-h-[42px] px-3.5 py-2.5 text-sm bg-white border border-stone-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
                />
                {VERIFICATION_CONFIG.enabled && (
                  <p className="text-xs text-slate-500">
                    Verification is enabled: please use the email registered with STARTATHON 2026.
                  </p>
                )}
              </div>

              <label className="flex items-start gap-3 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => {
                    setConfirmed(e.target.checked);
                    if (formError) setFormError(null);
                  }}
                  className="mt-1 h-4 w-4 rounded border-stone-300 text-blue-900 focus:ring-blue-900"
                />
                <span className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                  I confirm that my Full Name, Department, and Email details above are accurate and should be printed on my STARTATHON 2026 participation certificate.
                </span>
              </label>

              {formError && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 p-3.5 text-xs sm:text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg"
                >
                  <AlertCircle className="w-4 h-4 text-red-700 mt-0.5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full min-h-[46px] mt-1 px-6 py-3 text-sm font-semibold text-white bg-blue-900 rounded-lg hover:bg-blue-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900 focus-visible:ring-offset-2"
              >
                Generate My Certificate
              </button>
            </form>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Certificate Ready Top Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 pb-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-800 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>Certificate Generated</span>
                </div>
                <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-slate-900">
                  {generatedData.fullName}
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-600 mt-1">
                  <span>{generatedData.department} Department</span>
                  <span aria-hidden="true">·</span>
                  <span>{generatedData.email}</span>
                  <span aria-hidden="true">·</span>
                  <span>25.09.2026</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleGenerateAgain}
                  className="flex items-center gap-2 min-h-[42px] px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-4 h-4" />
                  Generate Again
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPng}
                  disabled={isRendering || !!renderError || isDownloadingPng}
                  className="flex items-center gap-2 min-h-[42px] px-4 py-2 text-xs sm:text-sm font-semibold text-slate-900 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
                >
                  <ImageIcon className="w-4 h-4" />
                  {isDownloadingPng ? 'Preparing PNG...' : 'Download PNG'}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isRendering || !!renderError || isDownloadingPdf}
                  className="flex items-center gap-2 min-h-[42px] px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-900 rounded-lg hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
                >
                  {isDownloadingPdf ? (
                    <Download className="w-4 h-4" />
                  ) : (
                    <FileText className="w-4 h-4" />
                  )}
                  {isDownloadingPdf ? 'Preparing PDF...' : 'Download PDF'}
                </button>
              </div>
            </div>

            {/* Framed Certificate Preview */}
            <div className="bg-stone-100 border border-stone-200 rounded-xl p-3 sm:p-6 flex items-center justify-center relative">
              {renderError ? (
                <div className="py-16 text-center max-w-md flex flex-col items-center gap-3">
                  <AlertCircle className="w-6 h-6 text-red-700" />
                  <p className="text-sm font-medium text-slate-900">
                    {renderError}
                  </p>
                  <button
                    type="button"
                    onClick={handleGenerateAgain}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-900 rounded-lg hover:bg-blue-800"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Return to Form
                  </button>
                </div>
              ) : (
                <div className="relative w-full flex justify-center">
                  <canvas
                    ref={previewCanvasRef}
                    aria-label={`Participation certificate preview for ${generatedData.fullName}`}
                    className="w-full max-w-4xl h-auto rounded shadow-md bg-white"
                  />
                  {isRendering && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded">
                      <span className="text-sm font-medium text-slate-800">
                        Rendering your certificate...
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-stone-200 bg-white">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span>
            Students&apos; Council · St. Joseph&apos;s College of Engineering
          </span>
          <span>
            Generated locally in your browser · No account required
          </span>
        </div>
      </footer>
    </div>
  );
}
