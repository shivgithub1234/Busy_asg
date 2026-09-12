"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload, FileText, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { csvService, type ImportResult } from "@/lib/services/csv";
import { getErrorMessage } from "@/lib/api";
import { AuthGuard } from "@/components/shared/AuthGuard";
import { PageHeader } from "@/components/shared/PageHeader";
import { ErrorMessage } from "@/components/shared/ErrorMessage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STATUS_ICON = {
  created: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
  duplicate: <AlertCircle className="h-3.5 w-3.5 text-amber-500" />,
  rejected: <XCircle className="h-3.5 w-3.5 text-red-500" />,
};

const STATUS_BADGE: Record<string, "success" | "warning" | "destructive"> = {
  created: "success",
  duplicate: "warning",
  rejected: "destructive",
};

export default function ImportPage({ params }: { params: Promise<{ id: string; sessionId: string }> }) {
  const { sessionId } = React.use(params);
  const router = useRouter();

  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError("");
    setResult(null);
    try {
      const { data } = await csvService.import(sessionId, file);
      setResult(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <AuthGuard requireOrganizer>
      <div className="space-y-6">
        <div>
          <Button
            variant="ghost" size="sm" className="mb-3 -ml-2 text-zinc-500"
            onClick={() => router.back()}
          >
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />Back
          </Button>
          <PageHeader
            title="Bulk import"
            description="Upload a CSV file to register multiple attendees at once."
          />
        </div>

        <Card className="max-w-lg">
          <CardHeader><CardTitle className="text-sm">Upload CSV</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border-2 border-dashed border-zinc-200 p-8 text-center dark:border-zinc-700">
              <Upload className="mx-auto mb-3 h-8 w-8 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {file ? file.name : "Drop a CSV file here"}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                Required columns: <code className="font-mono">attendee_name</code>,{" "}
                <code className="font-mono">attendee_email</code>
              </p>
              <Button
                variant="outline" size="sm" className="mt-4"
                onClick={() => fileRef.current?.click()}
              >
                <FileText className="h-4 w-4" />Choose file
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            {error && <ErrorMessage message={error} />}

            <Button
              className="w-full"
              disabled={!file || uploading}
              onClick={handleUpload}
            >
              {uploading ? "Importing…" : "Import"}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <div className="space-y-4 max-w-2xl">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-emerald-50 px-4 py-3 text-center dark:bg-emerald-950/30">
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{result.summary.created}</p>
                <p className="text-xs text-emerald-600">Created</p>
              </div>
              <div className="rounded-lg bg-zinc-50 px-4 py-3 text-center dark:bg-zinc-800/50">
                <p className="text-2xl font-bold text-zinc-700 dark:text-zinc-300">{result.summary.skipped}</p>
                <p className="text-xs text-zinc-500">Skipped</p>
              </div>
              <div className="rounded-lg bg-zinc-50 px-4 py-3 text-center dark:bg-zinc-800/50">
                <p className="text-2xl font-bold text-zinc-700 dark:text-zinc-300">{result.summary.total}</p>
                <p className="text-xs text-zinc-500">Total rows</p>
              </div>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-sm">Per-row report</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {result.report.map((row) => (
                    <div key={row.row} className="flex items-start gap-2.5 text-sm">
                      <span className="shrink-0 w-8 text-right text-xs text-zinc-400 mt-0.5">
                        #{row.row}
                      </span>
                      {STATUS_ICON[row.status]}
                      <div className="flex-1 min-w-0">
                        {row.data?.email && (
                          <span className="text-zinc-700 dark:text-zinc-300">{row.data.email}</span>
                        )}
                        {row.reason && (
                          <span className="text-zinc-500"> — {row.reason}</span>
                        )}
                      </div>
                      <Badge variant={STATUS_BADGE[row.status]} className="shrink-0">
                        {row.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
