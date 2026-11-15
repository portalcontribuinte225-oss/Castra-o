import React from "react";
import { AlertCircle, CalendarDays, CheckCircle2, ClipboardList, RefreshCw } from "lucide-react";
import { AnimalHistoryTone, animalHistoryTone } from "./animal-history";
import type { AnimalHistoryItem } from "./animal-service-types";

export function AnimalHistoryIcon({ item }: { item: AnimalHistoryItem }) {
  switch (animalHistoryTone(item)) {
    case AnimalHistoryTone.DANGER: return <AlertCircle size={15} />;
    case AnimalHistoryTone.TRANSFER: return <RefreshCw size={15} />;
    case AnimalHistoryTone.SUCCESS: return <CheckCircle2 size={15} />;
    case AnimalHistoryTone.SCHEDULED: return <CalendarDays size={15} />;
    default: return <ClipboardList size={15} />;
  }
}
