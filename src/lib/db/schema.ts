import { pgTable, uuid, text, boolean, jsonb, integer,
         timestamp, time, numeric, uniqueIndex, primaryKey } from 'drizzle-orm/pg-core';

export const profiles = pgTable('profiles', {
  id:                 uuid('id').primaryKey(),
  displayName:        text('display_name').notNull(),
  avatarUrl:          text('avatar_url'),
  pushSubscription:   jsonb('push_subscription'),
  emailNotifications: boolean('email_notifications').default(true),
  pushNotifications:  boolean('push_notifications').default(true),
  createdAt:          timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const groups = pgTable('groups', {
  id:          uuid('id').primaryKey().defaultRandom(),
  name:        text('name').notNull(),
  sport:       text('sport').notNull().default('badminton'),
  city:        text('city').notNull().default('Brno'),
  inviteCode:  text('invite_code').unique().notNull(),
  createdBy:   uuid('created_by'),
  minPlayers:  integer('min_players').notNull().default(2),
  createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const venues = pgTable('venues', {
  id:            uuid('id').primaryKey().defaultRandom(),
  name:          text('name').notNull(),
  slug:          text('slug').unique().notNull(),
  address:       text('address'),
  city:          text('city').notNull().default('Brno'),
  bookingUrl:    text('booking_url'),
  scraperKey:    text('scraper_key').notNull(),
  scraperConfig: jsonb('scraper_config'),
  isActive:      boolean('is_active').default(true),
});

export const courts = pgTable('courts', {
  id:       uuid('id').primaryKey().defaultRandom(),
  venueId:  uuid('venue_id').notNull(),
  name:     text('name').notNull(),
  sport:    text('sport').notNull().default('badminton'),
});

export const slots = pgTable('slots', {
  id:          uuid('id').primaryKey().defaultRandom(),
  venueId:     uuid('venue_id').notNull(),
  courtId:     uuid('court_id'),
  startsAt:    timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt:      timestamp('ends_at', { withTimezone: true }).notNull(),
  priceCzk:    numeric('price_czk', { precision: 8, scale: 2 }),
  isAvailable: boolean('is_available').notNull(),
  scrapedAt:   timestamp('scraped_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  uniq: uniqueIndex().on(t.courtId, t.startsAt),
}));

export const userAvailability = pgTable('user_availability', {
  id:          uuid('id').primaryKey().defaultRandom(),
  userId:      uuid('user_id').notNull(),
  groupId:     uuid('group_id').notNull(),
  type:        text('type').notNull().default('recurring'),
  dayOfWeek:   integer('day_of_week'),
  timeFrom:    time('time_from'),
  timeTo:      time('time_to'),
  startsAt:    timestamp('starts_at', { withTimezone: true }),
  endsAt:      timestamp('ends_at', { withTimezone: true }),
  isException: boolean('is_exception').default(false),
});

export const venuePreferences = pgTable('venue_preferences', {
  groupId: uuid('group_id').notNull(),
  userId:  uuid('user_id').notNull(),
  venueId: uuid('venue_id').notNull(),
  rank:    integer('rank').notNull().default(1),
}, (t) => ({
  pk: primaryKey({ columns: [t.groupId, t.userId, t.venueId] }),
}));

export const groupMembers = pgTable('group_members', {
  groupId: uuid('group_id').notNull(),
  userId:  uuid('user_id').notNull(),
  role:    text('role').notNull().default('member'),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.groupId, t.userId] }),
}));

export const matches = pgTable('matches', {
  id:          uuid('id').primaryKey().defaultRandom(),
  groupId:     uuid('group_id').notNull(),
  slotId:      uuid('slot_id').notNull(),
  score:       numeric('score', { precision: 4, scale: 2 }),
  notifiedAt:  timestamp('notified_at', { withTimezone: true }),
  createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  uniq: uniqueIndex().on(t.groupId, t.slotId),
}));

export const notificationsLog = pgTable('notifications_log', {
  id:       uuid('id').primaryKey().defaultRandom(),
  matchId:  uuid('match_id').notNull(),
  userId:   uuid('user_id').notNull(),
  channel:  text('channel').notNull(),
  sentAt:   timestamp('sent_at', { withTimezone: true }).defaultNow(),
  status:   text('status'),
});
