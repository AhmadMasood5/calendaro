/**
 * Calendar block types and booking utilities
 *
 * Shared logic for processing bookings with Google Calendar statuses.
 * Types are null‑safe and consistent across availability, busy, and booked blocks.
 */

import {
  getBookingAttendeeStatuses,
  type BookingStatuses,
} from "@/lib/actions/calendar";
import type { AttendeeStatus } from "@/lib/google-calendar";
import type {
  HostBooking,
  HostUpcomingBooking,
} from "@/sanity/queries/bookings";

// ============================================================================
// Calendar Block Types
// ============================================================================

// A time block representing availability
export interface TimeBlock {
  id: string;
  start: Date;
  end: Date;
}

// A busy block from Google Calendar (read-only)
export interface BusyBlock {
  id: string;
  start: Date;
  end: Date;
  title: string;
  accountEmail: string;
}

// A booked meeting block (read-only, from Sanity bookings)
export interface BookedBlock {
  id: string;
  start: Date;
  end: Date;
  guestName: string | null;   // allow null explicitly
  guestEmail: string | null;  // allow null explicitly
  googleEventId?: string;
  /** Google Meet video conferencing link */
  meetLink?: string;
  /** Guest's response status from Google Calendar */
  attendeeStatus?: AttendeeStatus;
}

// Combined event type for the calendar
export type CalendarEvent = TimeBlock | BusyBlock | BookedBlock;

// Type guard to check if event is a busy block
export function isBusyBlock(event: CalendarEvent): event is BusyBlock {
  return "accountEmail" in event;
}

// Type guard to check if event is a booked block
export function isBookedBlock(event: CalendarEvent): event is BookedBlock {
  return "guestName" in event;
}

// Slot selection from calendar
export interface SlotInfo {
  start: Date;
  end: Date;
}

// Drag/resize interaction
export interface TimeBlockInteraction {
  event: TimeBlock;
  start: Date;
  end: Date;
}

// ============================================================================
// Booking Utility Types
// ============================================================================

/**
 * Minimal interface for any booking that has Google Calendar event data.
 * Compatible with both HostBooking and HostUpcomingBooking from Sanity.
 */
export interface BookingWithGoogleEvent {
  _id: string;
  googleEventId?: string | null;
  guestEmail?: string | null;
}

export type ProcessedBooking<T extends BookingWithGoogleEvent> = T & {
  guestStatus?: AttendeeStatus;
};

// ============================================================================
// Shared Processing Functions
// ============================================================================

/**
 * Fetch attendee statuses and filter out cancelled bookings.
 * This is the common logic used by both availability and bookings pages.
 *
 * @param bookings - Raw bookings from Sanity
 * @returns Tuple of [attendeeStatuses record, filtered active bookings with statuses]
 */
export async function processBookingsWithStatuses<
  T extends BookingWithGoogleEvent
>(
  bookings: T[]
): Promise<{
  statuses: Record<string, BookingStatuses>;
  activeBookings: ProcessedBooking<T>[];
}> {
  // Fetch attendee statuses for bookings with Google events
  const statuses = await getBookingAttendeeStatuses(
    bookings
      .filter((b) => b.googleEventId)
      .map((b) => ({
  id: b._id,
  googleEventId: b.googleEventId ?? null,   // allow null explicitly
  guestEmail: b.guestEmail ?? "",           // always a string
}))

  );

  // Filter out cancelled bookings and add status to each
  const activeBookings = bookings
    .filter((booking) => {
      const bookingStatus = statuses[booking._id];
      return !booking.googleEventId || !bookingStatus?.isCancelled;
    })
    .map((booking) => {
      const bookingStatus = statuses[booking._id];
      return {
        ...booking,
        guestStatus: bookingStatus?.guestStatus,
      };
    });

  return { statuses, activeBookings };
}
