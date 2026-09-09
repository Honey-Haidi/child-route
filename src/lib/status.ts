export type ChildTripStatus =
  | "WAITING_FOR_PICKUP"
  | "DRIVER_APPROACHING"
  | "PICKED_UP"
  | "ON_THE_WAY"
  | "ARRIVED_AT_SCHOOL"
  | "DROPPED_OFF"
  | "ABSENT"
  | "CANCELLED";

export type TripType = "MORNING_HOME_TO_SCHOOL" | "AFTERNOON_SCHOOL_TO_HOME";

export type TripStatus =
  | "SCHEDULED"
  | "STARTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "DELAYED";

type Tone = "neutral" | "info" | "good" | "warn" | "bad";

const toneClass: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-primary/10 text-primary",
  good: "bg-success/15 text-success",
  warn: "bg-warning/20 text-warning-foreground",
  bad: "bg-destructive/12 text-destructive",
};

export function childStatusLabel(status: ChildTripStatus, type: TripType): string {
  const morning = type === "MORNING_HOME_TO_SCHOOL";
  switch (status) {
    case "WAITING_FOR_PICKUP":
      return morning ? "Waiting for pickup" : "Waiting at school";
    case "DRIVER_APPROACHING":
      return morning ? "Vehicle approaching home" : "Vehicle approaching home";
    case "PICKED_UP":
      return morning ? "Picked up from home" : "Picked up from school";
    case "ON_THE_WAY":
      return morning ? "On the way to school" : "On the way home";
    case "ARRIVED_AT_SCHOOL":
      return "Arrived at school";
    case "DROPPED_OFF":
      return "Dropped off safely";
    case "ABSENT":
      return "Marked absent";
    case "CANCELLED":
      return "Cancelled";
  }
}

export function childStatusTone(status: ChildTripStatus): string {
  const map: Record<ChildTripStatus, Tone> = {
    WAITING_FOR_PICKUP: "neutral",
    DRIVER_APPROACHING: "warn",
    PICKED_UP: "info",
    ON_THE_WAY: "info",
    ARRIVED_AT_SCHOOL: "good",
    DROPPED_OFF: "good",
    ABSENT: "bad",
    CANCELLED: "bad",
  };
  return toneClass[map[status]];
}

export function childStatusIcon(status: ChildTripStatus): string {
  const map: Record<ChildTripStatus, string> = {
    WAITING_FOR_PICKUP: "⏳",
    DRIVER_APPROACHING: "📍",
    PICKED_UP: "🚌",
    ON_THE_WAY: "🚌",
    ARRIVED_AT_SCHOOL: "🏫",
    DROPPED_OFF: "🏠",
    ABSENT: "⚠️",
    CANCELLED: "✕",
  };
  return map[status];
}

export function tripTypeLabel(type: TripType): string {
  return type === "MORNING_HOME_TO_SCHOOL" ? "Morning · Home → School" : "Afternoon · School → Home";
}

export function tripStatusTone(status: TripStatus): string {
  const map: Record<TripStatus, Tone> = {
    SCHEDULED: "neutral",
    STARTED: "info",
    IN_PROGRESS: "info",
    COMPLETED: "good",
    CANCELLED: "bad",
    DELAYED: "warn",
  };
  return toneClass[map[status]];
}

export const ACTIVE_TRIP_STATUSES = ["STARTED", "IN_PROGRESS", "DELAYED"] as const;
