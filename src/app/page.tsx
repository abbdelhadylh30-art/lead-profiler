'use client'

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Loader2, Copy, Check, Sparkles, RotateCcw, ChevronRight, AlertTriangle, Wand2, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  STEP_ORDER,
  STEP_LABELS,
  STEP_DESCRIPTIONS,
  type StepName,
  type UserServices,
} from "@/lib/lead-profiler-types";

interface LeadObservation {
  lead_name: string;
  profession: string;
  apparent_subculture: string;
  westernization_signals: string;
  observation_notes: {
    pace: string;
    people_orientation: string;
    content_shape: string;
    engagement: string;
    self_presentation: string;
    pressure_tells: string;
  };
  additional_context?: string;
}

type StepStatus = "pending" | "running" | "done" | "error";

interface StepState {
  status: StepStatus;
  output?: Record<string, unknown>;
  duration_ms?: number;
  error?: string;
}

const SAMPLE_DATA: LeadObservation = {
  lead_name: "Dr. Ahmed Al-Rashid",
  profession: "Dental clinic owner (single clinic, Jeddah)",
  apparent_subculture: "Saudi national, Jeddah-based, mid-hybridization (UK educated, returned to KSA)",
  westernization_signals:
    "Posts in mixed Arabic/English; references Harvard Business Review; MBA from London; uses Western management frameworks in captions but addresses patients in formal Arabic",
  digital_presence_audit: {
    has_website: "yes",
    website_notes: "Has a basic clinic website with location and contact info. No online booking.",
    has_booking_or_payment_link: "no",
    booking_notes: "Patients call or DM to book. No online booking system.",
    has_google_reviews: "yes",
    google_reviews_notes: "4.3 stars, 87 reviews. Mostly positive, a few recent complaints about wait times.",
    primary_call_to_action: "call",
    competitor_digital_presence:
      "Cousin's clinic (opened 8 months ago) has a modern website with online booking, Instagram feed embedded, and Google reviews integration.",
    customer_complaint_pattern:
      "Recent Google reviews mention 'hard to get an appointment' and 'long wait times'. IG comments sometimes ask about online booking.",
  },
  observation_notes: {
    pace: "Posts 2-3 times per week on IG main feed. Stories daily, sometimes 5-6 per day. Replies to comments within 2-4 hours.",
    people_orientation:
      "Warm in replies to patients (uses 'habibi', emojis). Cool/curt in replies to peer dentists who challenge his methods. Deflects pricing questions publicly with 'DM us'.",
    content_shape:
      "Mix of educational carousels (patient FAQs, dental myths) and clinic-tour reels. Polished but not over-produced. Recently started posting 'case study' reels showing before/after.",
    engagement:
      "Replies to most patient comments. Ignores or dismissively likes comments from other dentists. Got into a public back-and-forth with a competitor dentist last month about Invisalign pricing — deleted the thread but screenshots are circulating.",
    self_presentation:
      "Front-and-center in reels (white coat, name embroidered). Behind-brand in carousels (uses clinic logo, no personal photo). Has a personal LinkedIn that's significantly more polished than his IG.",
    pressure_tells:
      "Stories during Eid season showed visible stress (clinic empty, staff on leave). Posted a 'reminder' about no-show patients that was unusually sharp in tone — then deleted it after 4 hours. Has started referencing 'the next phase of growth' in recent captions, which he never did before.",
  },
  additional_context:
    "Cousin also runs a dental clinic in north Jeddah — opened 8 months ago, slightly larger space. Ahmed's clinic is 4 years old. He's been mentioning 'legacy' and 'reputation' more often in last 2 months. Just hired a marketing consultant who's pushing him toward more video content.",
};

const EMPTY_DATA: LeadObservation = {
  lead_name: "",
  profession: "",
  apparent_subculture: "",
  westernization_signals: "",
  digital_presence_audit: {
    has_website: "no",
    has_booking_or_payment_link: "no",
    has_google_reviews: "no",
    primary_call_to_action: "dm",
  },
  observation_notes: {
    pace: "",
    people_orientation: "",
    content_shape: "",
    engagement: "",
    self_presentation: "",
    pressure_tells: "",
  },
  additional_context: "",
};

const DEFAULT_USER_SERVICES: UserServices = {
  primary: "",
  secondary: "",
  past_work_examples: [],
  track_record: "",
  service_depth: "",
};

const SAMPLE_USER_SERVICES: UserServices = {
  primary: "Custom web tools — landing pages, dashboards, functional apps (not just static sites)",
  secondary: "",
  past_work_examples: [
    "Booking dashboard for a Riyadh dental clinic",
    "Product page funnel for a Jeddah dropshipper",
    "Inventory dashboard for a Dammam retail store",
  ],
  track_record: "3 years building web tools for Gulf SMB owners. ~15 clients across dental, retail, and e-commerce.",
  service_depth: "I build real functional tools with working backends — not just landing pages. The tool solves an actual operational problem, not just looks pretty.",
};

export default function Home() {
  const [observation, setObservation] = useState<LeadObservation>(EMPTY_DATA);
  const [userServices, setUserServices] = useState<UserServices>(DEFAULT_USER_SERVICES);
  const [steps, setSteps] = useState<Record<StepName, StepState>>({
    step1_culture_map: { status: "pending" },
    step2_disc: { status: "pending" },
    step3a_status_anxiety: { status: "pending" },
    step3b_laws: { status: "pending" },
    step3_reconciliation: { status: "pending" },
    step4_influence: { status: "pending" },
    step5_spin: { status: "pending" },
  });
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState<StepName | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const updateObservation = useCallback(<K extends keyof LeadObservation>(key: K, value: LeadObservation[K]) => {
    setObservation((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateNote = useCallback(
    (key: keyof LeadObservation["observation_notes"], value: string) => {
      setObservation((prev) => ({
        ...prev,
        observation_notes: { ...prev.observation_notes, [key]: value },
      }));
    },
    [],
  );

  const callStep = useCallback(
    async (step: StepName, accumulated: Record<string, Record<string, unknown> | undefined>) => {
      const res = await fetch("/api/profile-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step, observation, userServices, ...accumulated }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: "Network error" }));
        throw new Error(errBody.error ?? `HTTP ${res.status}`);
      }
      return (await res.json()) as {
        step: StepName;
        output: Record<string, unknown>;
        duration_ms: number;
      };
    },
    [observation, userServices],
  );

  const runPipeline = useCallback(async () => {
    if (!observation.lead_name.trim() || !observation.profession.trim()) {
      toast.error("Lead name and profession are required");
      return;
    }
    if (!observation.observation_notes.pace.trim()) {
      toast.error("At least one observation note field is required (pace)");
      return;
    }
    if (!userServices.primary.trim()) {
      toast.error("Your services are required — fill in the 'What You Sell' section so the opener knows what to offer");
      return;
    }

    setIsRunning(true);
    setSteps({
      step1_culture_map: { status: "pending" },
      step2_disc: { status: "pending" },
      step3a_status_anxiety: { status: "pending" },
      step3b_laws: { status: "pending" },
      step3_reconciliation: { status: "pending" },
      step4_influence: { status: "pending" },
      step5_spin: { status: "pending" },
    });

    const accumulated: Record<string, Record<string, unknown> | undefined> = {};

    // Maps step name -> body key used by the API
    const stepToBodyKey: Record<StepName, string> = {
      step1_culture_map: "step1",
      step2_disc: "step2",
      step3a_status_anxiety: "step3a",
      step3b_laws: "step3b",
      step3_reconciliation: "step3_reconciled",
      step4_influence: "step4",
      step5_spin: "step5",
    };

    try {
      for (const step of STEP_ORDER) {
        // Skip step3b — it runs in parallel with step3a and is already done by the time we get here
        if (step === "step3b_laws") {
          continue;
        }

        setCurrentStep(step);
        setSteps((prev) => ({ ...prev, [step]: { status: "running" } }));

        // For step3a, run step3a + step3b in parallel
        if (step === "step3a_status_anxiety") {
          // Mark step3b as running too (they run in parallel)
          setSteps((prev) => ({
            ...prev,
            step3b_laws: { status: "running" },
          }));

          try {
            const [r3a, r3b] = await Promise.all([
              callStep("step3a_status_anxiety", accumulated),
              callStep("step3b_laws", accumulated),
            ]);

            accumulated.step3a = r3a.output;
            accumulated.step3b = r3b.output;

            // Update each step separately to ensure both states flush
            setSteps((prev) => ({
              ...prev,
              step3a_status_anxiety: {
                status: "done" as const,
                output: r3a.output,
                duration_ms: r3a.duration_ms,
              },
            }));
            setSteps((prev) => ({
              ...prev,
              step3b_laws: {
                status: "done" as const,
                output: r3b.output,
                duration_ms: r3b.duration_ms,
              },
            }));
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Unknown error";
            setSteps((prev) => ({
              ...prev,
              step3a_status_anxiety: { status: "error", error: msg },
              step3b_laws: { status: "error", error: msg },
            }));
            throw err;
          }
          continue;
        }

        try {
          const result = await callStep(step, accumulated);
          accumulated[stepToBodyKey[step]] = result.output;
          setSteps((prev) => ({
            ...prev,
            [step]: {
              status: "done",
              output: result.output,
              duration_ms: result.duration_ms,
            },
          }));
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          setSteps((prev) => ({ ...prev, [step]: { status: "error", error: msg } }));
          throw err;
        }
      }

      toast.success("Profile generated!");
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Pipeline failed";
      toast.error(`Pipeline failed: ${msg}`);
    } finally {
      setIsRunning(false);
      setCurrentStep(null);
    }
  }, [observation, userServices, callStep]);

  const reset = useCallback(() => {
    setObservation(EMPTY_DATA);
    setUserServices(DEFAULT_USER_SERVICES);
    setSteps({
      step1_culture_map: { status: "pending" },
      step2_disc: { status: "pending" },
      step3a_status_anxiety: { status: "pending" },
      step3b_laws: { status: "pending" },
      step3_reconciliation: { status: "pending" },
      step4_influence: { status: "pending" },
      step5_spin: { status: "pending" },
    });
  }, []);

  const loadSample = useCallback(() => {
    setObservation(SAMPLE_DATA);
    setUserServices(SAMPLE_USER_SERVICES);
    toast.info("Sample lead loaded — Dr. Ahmed Al-Rashid");
  }, []);

  const allDone =
    steps.step5_spin.status === "done" && steps.step4_influence.status === "done";
  const openerData = steps.step5_spin.output as
    | {
        opener_draft?: string;
        alternative_opener?: string;
        warnings?: string[];
        word_count?: number;
        confidence?: string;
        confidence_reason?: string;
        opener_language?: string;
        opener_register?: string;
        hook?: string;
        hook_type?: string;
        offer?: string;
        structure_check?: Record<string, string>;
        factuality_check?: {
          all_claims_traced?: string;
          claims_with_sources?: Array<{
            claim?: string;
            source?: string;
            source_detail?: string;
          }>;
          fabricated_claims?: string[];
        };
        programmatic_claim_check?: {
          primary_opener?: {
            passed?: string | boolean;
            rejected_claims?: Array<{
              claim_text?: string;
              claim_type?: string;
              reason?: string;
              pattern_matched?: string;
            }>;
            warnings?: string[];
          };
          alternative_opener?: {
            passed?: string | boolean;
            rejected_claims?: Array<{
              claim_text?: string;
              claim_type?: string;
              reason?: string;
              pattern_matched?: string;
            }>;
            warnings?: string[];
          } | null;
        };
      }
    | undefined;

  const chainSummary = {
    culture: (steps.step1_culture_map.output as { sub_culture?: string } | undefined)?.sub_culture,
    disc: (steps.step2_disc.output as { primary_dimension?: string; disc_style?: string } | undefined),
    drive: (steps.step3a_status_anxiety.output as { primary_drive?: string } | undefined)?.primary_drive,
    law: (steps.step3b_laws.output as { dominant_law?: string } | undefined)?.dominant_law,
    lever: (steps.step4_influence.output as { primary_lever?: string } | undefined)?.primary_lever,
  };

  const completedCount = STEP_ORDER.filter((s) => steps[s].status === "done").length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center">
              <Wand2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Lead Profiler</h1>
              <p className="text-xs text-muted-foreground">5-step research compression for cold WhatsApp openers</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={loadSample} disabled={isRunning}>
              <FileText className="w-4 h-4 mr-1.5" />
              Load Sample
            </Button>
            <Button variant="ghost" size="sm" onClick={reset} disabled={isRunning}>
              <RotateCcw className="w-4 h-4 mr-1.5" />
              Reset
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl px-4 py-8">
        {/* Hero / value prop */}
        <div className="mb-8 max-w-3xl">
          <h2 className="text-3xl font-bold tracking-tight mb-2">
            5-minute observation in. Pitch-ready opener out.
          </h2>
          <p className="text-muted-foreground">
            Paste your social-media observation notes for a lead. The 5-step chain —
            Culture Map → DiSC → Status Anxiety ∥ Laws of Human Nature → Influence → SPIN — produces
            a draft WhatsApp opener designed to feel like it came from someone who already understood them,
            not a cold pitch.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Input form — 3 cols */}
          <div className="lg:col-span-3 space-y-6">
            {/* What You Sell — comes first, fills once, persists */}
            <Card className="border-emerald-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>What You Sell</span>
                  <Badge variant="secondary" className="text-xs">fill once</Badge>
                </CardTitle>
                <CardDescription>
                  Your real services and track record. The opener draws ONLY from this — never invents social proof.
                  Fill this in once; it persists across leads.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="us_primary">Primary service *</Label>
                  <Textarea
                    id="us_primary"
                    value={userServices.primary}
                    onChange={(e) => setUserServices((p) => ({ ...p, primary: e.target.value }))}
                    placeholder="Custom web tools — landing pages, dashboards, functional apps"
                    disabled={isRunning}
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="us_secondary">Secondary service (optional)</Label>
                  <Input
                    id="us_secondary"
                    value={userServices.secondary ?? ""}
                    onChange={(e) => setUserServices((p) => ({ ...p, secondary: e.target.value }))}
                    placeholder="Legal translation, content writing, etc."
                    disabled={isRunning}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="us_track">Real track record</Label>
                  <Textarea
                    id="us_track"
                    value={userServices.track_record}
                    onChange={(e) => setUserServices((p) => ({ ...p, track_record: e.target.value }))}
                    placeholder="3 years building web tools for Gulf SMB owners. ~15 clients across dental, retail, e-commerce."
                    disabled={isRunning}
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="us_examples">Past work examples (one per line)</Label>
                  <Textarea
                    id="us_examples"
                    value={userServices.past_work_examples.join("\n")}
                    onChange={(e) =>
                      setUserServices((p) => ({
                        ...p,
                        past_work_examples: e.target.value.split("\n").filter((s) => s.trim()),
                      }))
                    }
                    placeholder={"Booking dashboard for a Riyadh dental clinic\nProduct page funnel for a Jeddah dropshipper\nInventory dashboard for a Dammam retail store"}
                    disabled={isRunning}
                    rows={4}
                    className="text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    These are the ONLY social proof the tool can use. If this is empty, the tool falls back to Authority + Liking — never invents credentials.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="us_depth">Service depth — what makes you different</Label>
                  <Textarea
                    id="us_depth"
                    value={userServices.service_depth}
                    onChange={(e) => setUserServices((p) => ({ ...p, service_depth: e.target.value }))}
                    placeholder="I build real functional tools with working backends — not just landing pages."
                    disabled={isRunning}
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Lead Observation — the per-lead input */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>Lead Observation</span>
                  <Badge variant="secondary" className="text-xs">5 min manual</Badge>
                </CardTitle>
                <CardDescription>
                  Take the 5-minute scroll. Paste shorthand notes across 6 signal categories. The tool handles interpretation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="lead_name">Lead name *</Label>
                    <Input
                      id="lead_name"
                      value={observation.lead_name}
                      onChange={(e) => updateObservation("lead_name", e.target.value)}
                      placeholder="Dr. Ahmed Al-Rashid"
                      disabled={isRunning}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profession">Profession *</Label>
                    <Input
                      id="profession"
                      value={observation.profession}
                      onChange={(e) => updateObservation("profession", e.target.value)}
                      placeholder="Dental clinic owner (Jeddah)"
                      disabled={isRunning}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apparent_subculture">Apparent sub-culture</Label>
                  <Input
                    id="apparent_subculture"
                    value={observation.apparent_subculture}
                    onChange={(e) => updateObservation("apparent_subculture", e.target.value)}
                    placeholder="Saudi national, Jeddah-based, UK educated"
                    disabled={isRunning}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="westernization_signals">Westernization signals</Label>
                  <Textarea
                    id="westernization_signals"
                    value={observation.westernization_signals}
                    onChange={(e) => updateObservation("westernization_signals", e.target.value)}
                    placeholder="English fluency, references to Western brands/frameworks, education markers"
                    disabled={isRunning}
                    rows={2}
                  />
                </div>

                <Separator />

                {/* Digital Presence Audit — 30-second factual inventory */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Label className="text-base font-semibold">Digital presence audit</Label>
                    <Badge variant="secondary" className="text-xs">30 sec factual check</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground -mt-1">
                    Quick factual inventory — does the lead have a website, booking link, Google reviews?
                    This drives the cost_of_absence hook for activation selling.
                  </p>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="audit_website" className="text-sm">Has website?</Label>
                      <Select
                        value={observation.digital_presence_audit.has_website}
                        onValueChange={(v) =>
                          setObservation((prev) => ({
                            ...prev,
                            digital_presence_audit: {
                              ...prev.digital_presence_audit,
                              has_website: v as "yes" | "no" | "weak",
                            },
                          }))
                        }
                        disabled={isRunning}
                      >
                        <SelectTrigger id="audit_website"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no">No website</SelectItem>
                          <SelectItem value="weak">Weak (just a link, no real site)</SelectItem>
                          <SelectItem value="yes">Yes, has a real website</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="audit_booking" className="text-sm">Booking/payment link?</Label>
                      <Select
                        value={observation.digital_presence_audit.has_booking_or_payment_link}
                        onValueChange={(v) =>
                          setObservation((prev) => ({
                            ...prev,
                            digital_presence_audit: {
                              ...prev.digital_presence_audit,
                              has_booking_or_payment_link: v as "yes" | "no",
                            },
                          }))
                        }
                        disabled={isRunning}
                      >
                        <SelectTrigger id="audit_booking"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no">No — DM/call only</SelectItem>
                          <SelectItem value="yes">Yes — has online booking/payment</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="audit_reviews" className="text-sm">Google reviews?</Label>
                      <Select
                        value={observation.digital_presence_audit.has_google_reviews}
                        onValueChange={(v) =>
                          setObservation((prev) => ({
                            ...prev,
                            digital_presence_audit: {
                              ...prev.digital_presence_audit,
                              has_google_reviews: v as "yes" | "no",
                            },
                          }))
                        }
                        disabled={isRunning}
                      >
                        <SelectTrigger id="audit_reviews"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no">No Google reviews presence</SelectItem>
                          <SelectItem value="yes">Yes, has Google reviews</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="audit_cta" className="text-sm">Primary call-to-action</Label>
                      <Select
                        value={observation.digital_presence_audit.primary_call_to_action}
                        onValueChange={(v) =>
                          setObservation((prev) => ({
                            ...prev,
                            digital_presence_audit: {
                              ...prev.digital_presence_audit,
                              primary_call_to_action: v as "dm" | "call" | "link" | "none" | "other",
                            },
                          }))
                        }
                        disabled={isRunning}
                      >
                        <SelectTrigger id="audit_cta"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dm">DM to order/book</SelectItem>
                          <SelectItem value="call">Call us</SelectItem>
                          <SelectItem value="link">Click a link</SelectItem>
                          <SelectItem value="none">No CTA visible</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="audit_competitor" className="text-sm">Competitor digital presence (optional)</Label>
                    <Textarea
                      id="audit_competitor"
                      value={observation.digital_presence_audit.competitor_digital_presence ?? ""}
                      onChange={(e) =>
                        setObservation((prev) => ({
                          ...prev,
                          digital_presence_audit: {
                            ...prev.digital_presence_audit,
                            competitor_digital_presence: e.target.value,
                          },
                        }))
                      }
                      placeholder="e.g., Layla Abayas (competitor) launched a website with online ordering 3 months ago"
                      disabled={isRunning}
                      rows={2}
                      className="text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="audit_complaints" className="text-sm">Customer complaint pattern (optional)</Label>
                    <Textarea
                      id="audit_complaints"
                      value={observation.digital_presence_audit.customer_complaint_pattern ?? ""}
                      onChange={(e) =>
                        setObservation((prev) => ({
                          ...prev,
                          digital_presence_audit: {
                            ...prev.digital_presence_audit,
                            customer_complaint_pattern: e.target.value,
                          },
                        }))
                      }
                      placeholder="e.g., Customers comment 'why don't you have a website?' or DM screenshots of competitor's site"
                      disabled={isRunning}
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label className="text-base font-semibold">Observation notes (6 categories)</Label>

                  {([
                    ["pace", "Pace signals", "Posting frequency, reply speed, content cadence"],
                    ["people_orientation", "People orientation", "Warmth vs. skepticism in captions and replies"],
                    ["content_shape", "Content shape", "Carousels, reels, formal posts, BTS, polished vs. raw"],
                    ["engagement", "Engagement style", "Reply patterns, tone, selectivity"],
                    ["self_presentation", "Self-presentation", "Front-and-center vs. behind-the-brand"],
                    ["pressure_tells", "Pressure tells", "Stories, rants, brags, withdrawal under stress"],
                  ] as const).map(([key, label, placeholder]) => (
                    <div key={key} className="space-y-1.5">
                      <Label htmlFor={`note-${key}`} className="text-sm font-medium">
                        {label}
                      </Label>
                      <Textarea
                        id={`note-${key}`}
                        value={observation.observation_notes[key]}
                        onChange={(e) => updateNote(key, e.target.value)}
                        placeholder={placeholder}
                        disabled={isRunning}
                        rows={2}
                        className="text-sm"
                      />
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="additional_context">Additional context (optional)</Label>
                  <Textarea
                    id="additional_context"
                    value={observation.additional_context ?? ""}
                    onChange={(e) => updateObservation("additional_context", e.target.value)}
                    placeholder="Competitors, family dynamics in the business, recent changes, anything else relevant"
                    disabled={isRunning}
                    rows={3}
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    onClick={runPipeline}
                    disabled={isRunning || !observation.lead_name.trim() || !observation.profession.trim()}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    size="lg"
                  >
                    {isRunning ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Running pipeline...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate Profile
                      </>
                    )}
                  </Button>
                  {completedCount > 0 && !isRunning && (
                    <span className="text-sm text-muted-foreground">
                      {completedCount}/{STEP_ORDER.length} steps complete
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Progress sidebar — 2 cols */}
          <div className="lg:col-span-2">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="text-base">Pipeline Progress</CardTitle>
                <CardDescription>5 steps run sequentially. Step 3a + 3b run in parallel.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                {STEP_ORDER.map((step) => {
                  const state = steps[step];
                  const isParallelPair = step === "step3a_status_anxiety" || step === "step3b_laws";
                  return (
                    <div
                      key={step}
                      className={`flex items-start gap-3 p-3 rounded-md border transition-colors ${
                        state.status === "running"
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20"
                          : state.status === "done"
                            ? "border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/10"
                            : state.status === "error"
                              ? "border-red-300 bg-red-50 dark:bg-red-950/20"
                              : "border-border"
                      }`}
                    >
                      <div className="mt-0.5">
                        {state.status === "running" && <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />}
                        {state.status === "done" && <Check className="w-4 h-4 text-emerald-600" />}
                        {state.status === "error" && <AlertTriangle className="w-4 h-4 text-red-600" />}
                        {state.status === "pending" && (
                          <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{STEP_LABELS[step]}</span>
                          {isParallelPair && (
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5">parallel</Badge>
                          )}
                          {state.duration_ms && (
                            <span className="text-[11px] text-muted-foreground">
                              {(state.duration_ms / 1000).toFixed(1)}s
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {state.status === "error"
                            ? state.error
                            : STEP_DESCRIPTIONS[step]}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Results */}
        <div ref={resultsRef} className="mt-10 space-y-6">
          {allDone && openerData && (
            <>
              {/* Final opener — prominent */}
              <Card className="border-emerald-500 border-2 bg-emerald-50/30 dark:bg-emerald-950/10">
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 flex-wrap">
                        <Sparkles className="w-5 h-5 text-emerald-600" />
                        Draft WhatsApp Opener
                        {openerData.opener_language && (
                          <Badge variant="default" className="text-xs">
                            {openerData.opener_language === "arabic" ? "العربية" : "English"}
                          </Badge>
                        )}
                        {openerData.hook_type && (
                          <Badge variant="outline" className="text-xs">
                            hook: {openerData.hook_type}
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Ready to send. {openerData.word_count ?? 0} words.
                        {openerData.confidence && (
                          <> Confidence: <span className="font-medium">{openerData.confidence}</span></>
                        )}
                        {openerData.opener_register && openerData.opener_language === "arabic" && (
                          <> · Register: <span className="font-medium">{openerData.opener_register}</span></>
                        )}
                      </CardDescription>
                    </div>
                    <CopyButton text={openerData.opener_draft ?? ""} label="Copy opener" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div
                    className="bg-white dark:bg-zinc-900 border rounded-md p-4 text-sm leading-relaxed whitespace-pre-wrap"
                    dir={openerData.opener_language === "arabic" ? "rtl" : "ltr"}
                    style={{ fontFamily: openerData.opener_language === "arabic" ? "'Noto Sans Arabic', 'Segoe UI', system-ui, sans-serif" : "inherit", fontSize: "16px", lineHeight: 1.7 }}
                  >
                    {openerData.opener_draft}
                  </div>

                  {/* Hook inspection */}
                  {openerData.hook && (
                    <div className="mt-4 p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200">
                      <div className="text-xs text-emerald-700 dark:text-emerald-300 uppercase tracking-wide font-semibold mb-1">
                        The Hook (first ~12 words)
                      </div>
                      <div
                        className="text-sm font-medium text-emerald-900 dark:text-emerald-100"
                        dir={openerData.opener_language === "arabic" ? "rtl" : "ltr"}
                      >
                        {openerData.hook}
                      </div>
                    </div>
                  )}

                  {/* Offer inspection */}
                  {openerData.offer && (
                    <div className="mt-3 p-3 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200">
                      <div className="text-xs text-blue-700 dark:text-blue-300 uppercase tracking-wide font-semibold mb-1">
                        Offer Used
                      </div>
                      <div className="text-sm text-blue-900 dark:text-blue-100">
                        {openerData.offer}
                      </div>
                    </div>
                  )}

                  {/* Factuality check — critical honesty layer */}
                  {openerData.factuality_check && (
                    <div className={`mt-4 p-3 rounded-md border ${
                      openerData.factuality_check.all_claims_traced === "yes"
                        ? "bg-green-50 dark:bg-green-950/30 border-green-300"
                        : "bg-red-50 dark:bg-red-950/30 border-red-300"
                    }`}>
                      <div className={`text-xs uppercase tracking-wide font-semibold mb-2 ${
                        openerData.factuality_check.all_claims_traced === "yes"
                          ? "text-green-700 dark:text-green-300"
                          : "text-red-700 dark:text-red-300"
                      }`}>
                        Factuality Check · {openerData.factuality_check.all_claims_traced === "yes" ? "✓ All claims traced" : "✗ FABRICATED CLAIMS DETECTED"}
                      </div>
                      {openerData.factuality_check.claims_with_sources &&
                        openerData.factuality_check.claims_with_sources.length > 0 && (
                          <div className="space-y-2">
                            {openerData.factuality_check.claims_with_sources.map((c, i) => (
                              <div key={i} className="text-xs">
                                <div className="font-medium text-foreground">"{c.claim}"</div>
                                <div className="text-muted-foreground ml-3 mt-0.5">
                                  source:{" "}
                                  <span className={`font-medium ${
                                    c.source === "NONE" || c.source_detail === "FABRICATED"
                                      ? "text-red-600 dark:text-red-400"
                                      : "text-green-700 dark:text-green-400"
                                  }`}>
                                    {c.source === "NONE" ? "FABRICATED" : c.source}
                                  </span>
                                  {c.source_detail && c.source !== "NONE" && c.source_detail !== "FABRICATED" && (
                                    <> — {c.source_detail}</>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      {openerData.factuality_check.fabricated_claims &&
                        openerData.factuality_check.fabricated_claims.length > 0 && (
                          <Alert variant="destructive" className="mt-2">
                            <AlertTriangle className="w-4 h-4" />
                            <AlertTitle>Fabricated claims — DO NOT SEND</AlertTitle>
                            <AlertDescription>
                              <ul className="list-disc list-inside mt-1 text-xs">
                                {openerData.factuality_check.fabricated_claims.map((c, i) => (
                                  <li key={i}>{c}</li>
                                ))}
                              </ul>
                            </AlertDescription>
                          </Alert>
                        )}
                    </div>
                  )}

                  {/* Programmatic claim check — code-level backstop (not LLM self-audit) */}
                  {openerData.programmatic_claim_check?.primary_opener && (() => {
                    const check = openerData.programmatic_claim_check!.primary_opener!;
                    const passed = check.passed === true || check.passed === "yes" || check.passed === "true";
                    const rejected = check.rejected_claims ?? [];
                    return (
                      <div className={`mt-4 p-3 rounded-md border-2 ${
                        passed
                          ? "bg-green-50 dark:bg-green-950/30 border-green-400"
                          : "bg-red-50 dark:bg-red-950/30 border-red-400 border-dashed"
                      }`}>
                        <div className={`text-xs uppercase tracking-wide font-bold mb-2 ${
                          passed
                            ? "text-green-800 dark:text-green-300"
                            : "text-red-800 dark:text-red-300"
                        }`}>
                          {passed
                            ? "✓ Code-level claim check passed"
                            : "✗ CODE-LEVEL CLAIM CHECK FAILED — DO NOT SEND"}
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">
                          Programmatic scan (not LLM self-audit) for fabricated numbers, locations, and metrics.
                          {passed
                            ? " No unverifiable claim patterns detected."
                            : " The opener contains specific claims that cannot be traced to your user_services or observation notes."}
                        </p>
                        {rejected.length > 0 && (
                          <div className="space-y-2">
                            {rejected.map((c, i) => (
                              <div key={i} className="text-xs bg-red-100 dark:bg-red-950/50 p-2 rounded border border-red-300">
                                <div className="font-mono font-bold text-red-900 dark:text-red-200">"{c.claim_text}"</div>
                                <div className="text-red-700 dark:text-red-300 mt-1">
                                  <span className="font-medium">Type:</span> {c.claim_type} · <span className="font-medium">Pattern:</span> {c.pattern_matched}
                                </div>
                                <div className="text-red-700 dark:text-red-300 mt-0.5">
                                  {c.reason}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {check.warnings && check.warnings.length > 0 && (
                          <div className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                            {check.warnings.map((w, i) => (
                              <div key={i}>⚠ {w}</div>
                            ))}
                          </div>
                        )}
                        {!passed && (
                          <div className="mt-3 text-xs text-red-800 dark:text-red-200 font-medium">
                            Action: edit the opener to remove the rejected claims, OR re-run Step 5 (it may produce a different opener). Do NOT send as-is.
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {openerData.structure_check && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {Object.entries(openerData.structure_check).map(([k, v]) => (
                        <Badge
                          key={k}
                          variant={v === "yes" || v === "no" ? (v === "yes" ? "default" : "secondary") : "outline"}
                          className="text-xs"
                        >
                          {k.replace(/_/g, " ")}: {String(v)}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {openerData.warnings && openerData.warnings.length > 0 && (
                    <Alert className="mt-4 border-amber-300 bg-amber-50 dark:bg-amber-950/20">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <AlertTitle className="text-amber-900 dark:text-amber-200">Warnings — read before sending</AlertTitle>
                      <AlertDescription className="text-amber-900 dark:text-amber-200">
                        <ul className="list-disc list-inside mt-1 space-y-1 text-sm">
                          {openerData.warnings.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Alternative opener */}
              {openerData.alternative_opener && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <CardTitle className="text-base">Alternative Opener (A/B test)</CardTitle>
                        <CardDescription>A second version with a different lever or angle.</CardDescription>
                      </div>
                      <CopyButton text={openerData.alternative_opener} label="Copy alternative" small />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted/50 border rounded-md p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap">
                      {openerData.alternative_opener}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Chain summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Chain Summary</CardTitle>
                  <CardDescription>How the 5 steps landed for this lead.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <SummaryItem label="Culture" value={chainSummary.culture} />
                    <SummaryItem
                      label="DiSC"
                      value={
                        chainSummary.disc
                          ? `${chainSummary.disc.primary_dimension ?? "?"} (${chainSummary.disc.disc_style ?? "?"})`
                          : undefined
                      }
                    />
                    <SummaryItem label="Status drive" value={chainSummary.drive} />
                    <SummaryItem label="Dominant law" value={chainSummary.law} />
                    <SummaryItem label="Persuasion lever" value={chainSummary.lever} />
                  </div>
                </CardContent>
              </Card>

              {/* Step-by-step outputs (accordion) */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Step-by-step Outputs</CardTitle>
                  <CardDescription>
                    Inspect each step&apos;s full JSON output. Use this to debug when an opener misfires —
                    trace back through the chain to find which step made the wrong call.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Accordion type="multiple" className="w-full">
                    {STEP_ORDER.map((step) => {
                      const state = steps[step];
                      if (state.status !== "done" || !state.output) return null;
                      return (
                        <AccordionItem key={step} value={step}>
                          <AccordionTrigger className="text-sm">
                            <div className="flex items-center gap-3">
                              <span className="font-medium">{STEP_LABELS[step]}</span>
                              {state.duration_ms && (
                                <span className="text-xs text-muted-foreground">
                                  {(state.duration_ms / 1000).toFixed(1)}s
                                </span>
                              )}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <pre className="text-xs bg-muted/50 p-3 rounded-md overflow-x-auto max-h-96">
                              {JSON.stringify(state.output, null, 2)}
                            </pre>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </CardContent>
              </Card>
            </>
          )}

          {!allDone && !isRunning && completedCount === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-muted-foreground">
                <ChevronRight className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">
                  Fill in the observation notes and click <span className="font-medium text-foreground">Generate Profile</span> to run the 5-step chain.
                </p>
                <p className="text-xs mt-2">
                  Or click <span className="font-medium text-foreground">Load Sample</span> in the header to see a worked example.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <footer className="border-t mt-16 py-6">
        <div className="container mx-auto max-w-6xl px-4 text-center text-xs text-muted-foreground">
          Lead Profiler v1 · 5-step chain: Culture Map → DiSC → Status Anxiety ∥ Laws → Influence → SPIN · ~30s per lead
        </div>
      </footer>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value?: string }) {
  return (
    <div className="p-3 rounded-md border bg-muted/30">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-sm font-medium mt-1">{value ?? "—"}</div>
    </div>
  );
}

function CopyButton({ text, label, small }: { text: string; label: string; small?: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }, [text]);

  return (
    <Button variant="outline" size={small ? "sm" : "default"} onClick={handleCopy}>
      {copied ? (
        <>
          <Check className="w-4 h-4 mr-1.5" />
          Copied
        </>
      ) : (
        <>
          <Copy className="w-4 h-4 mr-1.5" />
          {label}
        </>
      )}
    </Button>
  );
}
