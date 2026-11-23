import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  username: text('username').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  virtualBalance: doublePrecision('virtual_balance').notNull().default(0),
  role: text('role').notNull().default('user'),
  favoriteTeams: text('favorite_teams').notNull().default('[]'),
  favoriteSports: text('favorite_sports').notNull().default('[]'),
  resetToken: text('reset_token'),
  resetTokenExpires: timestamp('reset_token_expires'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sports = pgTable('sports', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  icon: text('icon').notNull(),
});

export const competitions = pgTable('competitions', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  sportId: integer('sport_id')
    .references(() => sports.id)
    .notNull(),
  country: text('country').notNull(),
  featured: boolean('featured').notNull().default(false),
});

export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  shortName: text('short_name').notNull(),
  logo: text('logo').notNull(),
  sportId: integer('sport_id')
    .references(() => sports.id)
    .notNull(),
});

export const matches = pgTable('matches', {
  id: serial('id').primaryKey(),
  externalId: text('external_id').unique(),
  sportId: integer('sport_id')
    .references(() => sports.id)
    .notNull(),
  competitionId: integer('competition_id')
    .references(() => competitions.id)
    .notNull(),
  homeTeamId: integer('home_team_id')
    .references(() => teams.id)
    .notNull(),
  awayTeamId: integer('away_team_id')
    .references(() => teams.id)
    .notNull(),
  homeScore: integer('home_score').notNull().default(0),
  awayScore: integer('away_score').notNull().default(0),
  status: text('status').notNull().default('upcoming'),
  matchTimer: text('match_timer').notNull().default('00:00'),
  startTime: timestamp('start_time').notNull(),
  dataSource: text('data_source').notNull().default('simulated'),
  featured: boolean('featured').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const markets = pgTable('markets', {
  id: serial('id').primaryKey(),
  matchId: integer('match_id')
    .references(() => matches.id, { onDelete: 'cascade' })
    .notNull(),
  marketType: text('market_type').notNull(),
  selectionName: text('selection_name').notNull(),
  simulatedOdds: doublePrecision('simulated_odds').notNull(),
  active: boolean('active').notNull().default(true),
});

export const virtualBets = pgTable('virtual_bets', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  reference: text('reference').notNull().unique(),
  idempotencyKey: text('idempotency_key').unique(),
  virtualStake: doublePrecision('virtual_stake').notNull(),
  combinedOdds: doublePrecision('combined_odds').notNull(),
  potentialVirtualWinnings: doublePrecision('potential_virtual_winnings').notNull(),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const virtualBetSelections = pgTable('virtual_bet_selections', {
  id: serial('id').primaryKey(),
  virtualBetId: integer('virtual_bet_id')
    .references(() => virtualBets.id, { onDelete: 'cascade' })
    .notNull(),
  matchId: integer('match_id')
    .references(() => matches.id)
    .notNull(),
  marketId: integer('market_id')
    .references(() => markets.id)
    .notNull(),
  marketType: text('market_type').notNull(),
  selectionName: text('selection_name').notNull(),
  simulatedOdds: doublePrecision('simulated_odds').notNull(),
  matchLabel: text('match_label').notNull(),
  result: text('result').notNull().default('pending'),
});

export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  amount: doublePrecision('amount').notNull(),
  transactionType: text('transaction_type').notNull(),
  description: text('description').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  adminId: integer('admin_id')
    .references(() => users.id)
    .notNull(),
  action: text('action').notNull(),
  details: text('details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const promotionsClaimed = pgTable('promotions_claimed', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  promoCode: text('promo_code').notNull(),
  rewardCredits: doublePrecision('reward_credits').notNull(),
  claimedAt: timestamp('claimed_at').defaultNow().notNull(),
});

export const depositRequests = pgTable('deposit_requests', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  method: text('method').notNull(), // 'tickets' | 'D17'
  operator: text('operator').notNull(), // 'Ooredoo' | 'Orange' | 'Tunisie Telecom' | 'D17'
  amount: doublePrecision('amount').notNull(),
  ticketCodes: text('ticket_codes').notNull().default('[]'),
  phoneNumber: text('phone_number'),
  screenshotData: text('screenshot_data'),
  note: text('note'),
  status: text('status').notNull().default('pending'), // 'pending' | 'approved' | 'rejected'
  adminNote: text('admin_note'),
  processedBy: integer('processed_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  processedAt: timestamp('processed_at'),
});

export const contactMessages = pgTable('contact_messages', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  senderId: integer('sender_id')
    .references(() => users.id)
    .notNull(),
  senderRole: text('sender_role').notNull(), // 'user' | 'admin'
  senderName: text('sender_name').notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  virtualBets: many(virtualBets),
  transactions: many(transactions),
  auditLogs: many(auditLogs),
  promotionsClaimed: many(promotionsClaimed),
  depositRequests: many(depositRequests),
  contactMessages: many(contactMessages),
}));

export const sportsRelations = relations(sports, ({ many }) => ({
  competitions: many(competitions),
  teams: many(teams),
  matches: many(matches),
}));

export const competitionsRelations = relations(competitions, ({ one, many }) => ({
  sport: one(sports, {
    fields: [competitions.sportId],
    references: [sports.id],
  }),
  matches: many(matches),
}));

export const teamsRelations = relations(teams, ({ one }) => ({
  sport: one(sports, {
    fields: [teams.sportId],
    references: [sports.id],
  }),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  sport: one(sports, {
    fields: [matches.sportId],
    references: [sports.id],
  }),
  competition: one(competitions, {
    fields: [matches.competitionId],
    references: [competitions.id],
  }),
  homeTeam: one(teams, {
    fields: [matches.homeTeamId],
    references: [teams.id],
  }),
  awayTeam: one(teams, {
    fields: [matches.awayTeamId],
    references: [teams.id],
  }),
  markets: many(markets),
}));

export const marketsRelations = relations(markets, ({ one }) => ({
  match: one(matches, {
    fields: [markets.matchId],
    references: [matches.id],
  }),
}));

export const virtualBetsRelations = relations(virtualBets, ({ one, many }) => ({
  user: one(users, {
    fields: [virtualBets.userId],
    references: [users.id],
  }),
  selections: many(virtualBetSelections),
}));

export const virtualBetSelectionsRelations = relations(virtualBetSelections, ({ one }) => ({
  virtualBet: one(virtualBets, {
    fields: [virtualBetSelections.virtualBetId],
    references: [virtualBets.id],
  }),
  match: one(matches, {
    fields: [virtualBetSelections.matchId],
    references: [matches.id],
  }),
  market: one(markets, {
    fields: [virtualBetSelections.marketId],
    references: [markets.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  admin: one(users, {
    fields: [auditLogs.adminId],
    references: [users.id],
  }),
}));

export const depositRequestsRelations = relations(depositRequests, ({ one }) => ({
  user: one(users, {
    fields: [depositRequests.userId],
    references: [users.id],
  }),
}));

export const contactMessagesRelations = relations(contactMessages, ({ one }) => ({
  user: one(users, {
    fields: [contactMessages.userId],
    references: [users.id],
  }),
}));
