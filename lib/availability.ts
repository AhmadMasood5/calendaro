/**
 * Availability computation utilities
 *
 * Pure functions for computing available dates and slots.
 * These can be used both in server components (with sanityFetch data)
 * and in server actions.
 */

import {
  startOfDay,
  endOfDay,
  addMinutes,
  addDays,
  isWithinInterval,
  parseISO,
  format,
} from "date-fns";

// ============================================================================
// Types
// ============================================================================

export type AvailabilitySlot = {
  _key: string;
  startDateTime: string;
  endDateTime: string;
};

export type BookingSlot = {
  _id: string;
  startTime: string;
  endTime: string;
};

export type BusyTime = {
  start: Date;
  end: Date;
};

// ============================================================================
// Core Computation Functions
// ============================================================================

/**
 * Compute available dates from host availability and existing bookings.
 * This is a pure function that doesn't fetch any data.
 *
 * @param availability - Host's availability slots
 * @param bookings - Existing confirmed bookings
 * @param startDate - Range start
 * @param endDate - Range end
 * @param slotDurationMinutes - Duration of each slot
 * @param busyTimes - Optional Google Calendar busy times
 * @returns Array of date strings in YYYY-MM-DD format
 */
export function computeAvailableDates(
  availability: AvailabilitySlot[],
  bookings: BookingSlot[],
  startDate: Date,
  endDate: Date,
  slotDurationMinutes = 30,
  busyTimes: BusyTime[] = []
): string[] {
  const today = startOfDay(new Date());
  const dayCount = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  return Array.from({ length: dayCount }, (_, i) => addDays(startOfDay(startDate), i))
    .filter((currentDate) => currentDate >= today && currentDate <= endDate)
    .filter((currentDate) => {
      const dayStart = startOfDay(currentDate);
      const dayEnd = endOfDay(currentDate);

      // Find availability blocks for this day
      const availabilityForDate = availability.filter((slot) => {
        const slotStart = parseISO(slot.startDateTime);
        const slotEnd = parseISO(slot.endDateTime);

        return (
          isWithinInterval(slotStart, { start: dayStart, end: dayEnd }) ||
          isWithinInterval(slotEnd, { start: dayStart, end: dayEnd }) ||
          (slotStart <= dayStart && slotEnd >= dayEnd)
        );
      });

      if (availabilityForDate.length === 0) return false;

      return checkDayHasAvailableSlot(
        availabilityForDate,
        bookings,
        dayStart,
        dayEnd,
        slotDurationMinutes,
        busyTimes
      );
    })
    .map((currentDate) => format(currentDate, "yyyy-MM-dd"));
}

/**
 * Generate all slot start times within a time range
 */
function generateSlotStarts(
  rangeStart: Date,
  rangeEnd: Date,
  durationMinutes: number
): Date[] {
  const slotCount = Math.floor((rangeEnd.getTime() - rangeStart.getTime()) / (durationMinutes * 60 * 1000));
  return Array.from({ length: slotCount }, (_, i) => addMinutes(rangeStart, i * durationMinutes));
}

/**
 * Compute available time slots for a specific date.
 * This is a pure function that doesn't fetch any data.
 */
export function computeAvailableSlots(
  availability: AvailabilitySlot[],
  bookings: BookingSlot[],
  date: Date,
  slotDurationMinutes = 30,
  busyTimes: BusyTime[] = []
): Array<{ start: Date; end: Date }> {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  const now = new Date();

  // Find availability blocks for this day
  const availabilityForDate = availability.filter((slot) => {
    const slotStart = parseISO(slot.startDateTime);
    const slotEnd = parseISO(slot.endDateTime);

    return (
      isWithinInterval(slotStart, { start: dayStart, end: dayEnd }) ||
      isWithinInterval(slotEnd, { start: dayStart, end: dayEnd }) ||
      (slotStart <= dayStart && slotEnd >= dayEnd)
    );
  });

  return availabilityForDate.flatMap((availSlot) => {
    const availStart = parseISO(availSlot.startDateTime);
    const availEnd = parseISO(availSlot.endDateTime);

    // Clamp to day boundaries
    const slotStart = availStart < dayStart ? dayStart : availStart;
    const slotEnd = availEnd > dayEnd ? dayEnd : availEnd;

    // Generate potential slot start times
    const slotStarts = generateSlotStarts(slotStart, slotEnd, slotDurationMinutes);

    // Filter out past slots and slots with conflicts
    return slotStarts
      .filter((currentStart) => currentStart >= now)
      .filter((currentStart) => {
        const currentEnd = addMinutes(currentStart, slotDurationMinutes);

        // Check if this slot is blocked by a booking
        const hasBookingConflict = bookings.some((booking) => {
          const bookingStart = parseISO(booking.startTime);
          const bookingEnd = parseISO(booking.endTime);
          return currentStart < bookingEnd && currentEnd > bookingStart;
        });

        // Check if this slot is blocked by busy time
        const hasBusyConflict = busyTimes.some((busy) => {
          return currentStart < busy.end && currentEnd > busy.start;
        });

        return !hasBookingConflict && !hasBusyConflict;
      })
      .map((currentStart) => ({
        start: new Date(currentStart),
        end: addMinutes(currentStart, slotDurationMinutes),
      }));
  });
}

/**
 * Check if a specific day has at least one available slot
 */
function checkDayHasAvailableSlot(
  availabilityForDate: AvailabilitySlot[],
  bookings: BookingSlot[],
  dayStart: Date,
  dayEnd: Date,
  slotDurationMinutes: number,
  busyTimes: BusyTime[]
): boolean {
  return availabilityForDate.some((availSlot) => {
    const availStart = parseISO(availSlot.startDateTime);
    const availEnd = parseISO(availSlot.endDateTime);

    const slotStart = availStart < dayStart ? dayStart : availStart;
    const slotEnd = availEnd > dayEnd ? dayEnd : availEnd;

    // Generate potential slots
    const potentialSlots = generateSlotStarts(slotStart, slotEnd, slotDurationMinutes);

    return potentialSlots.some((currentStart) => {
      const currentEnd = addMinutes(currentStart, slotDurationMinutes);

      // Check if this slot is blocked by a booking
      const hasBookingConflict = bookings.some((booking) => {
        const bookingStart = parseISO(booking.startTime);
        const bookingEnd = parseISO(booking.endTime);
        return currentStart < bookingEnd && currentEnd > bookingStart;
      });

      // Check if this slot is blocked by busy time
      const hasBusyConflict = busyTimes.some((busy) => {
        return currentStart < busy.end && currentEnd > busy.start;
      });

      return !hasBookingConflict && !hasBusyConflict;
    });
  });
}