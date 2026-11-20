import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const runs = sqliteTable("race_runs", {
  id: text("id").primaryKey(),
  player: text("player").notNull(),
  network: text("network").notNull(),
  route: text("route").notNull(),
  started: integer("started").notNull(),
  score: integer("score"),
  name: text("name"),
  updated: integer("updated"),
}, (t) => [
  index("race_runs_started").on(t.started),
  index("race_runs_player_time").on(t.player,t.started),
  index("race_runs_network_time").on(t.network,t.started),
]);

export const records = sqliteTable("race_records", {
  route: text("route").notNull(),
  player: text("player").notNull(),
  score: integer("score").notNull(),
  name: text("name").notNull(),
  achieved: integer("achieved").notNull(),
}, (t) => [
  primaryKey({columns:[t.route,t.player]}),
  index("race_records_order").on(t.route,t.score,t.achieved,t.player),
]);
