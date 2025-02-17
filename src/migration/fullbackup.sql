

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pgsodium";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."get_email_ids_by_tag"("user_id_param" "uuid", "tag_name_param" "text") RETURNS TABLE("email_id" "text", "thread_id" "text")
    LANGUAGE "sql" STABLE
    AS $$
  SELECT et.email_id, e.thread_id
  FROM email_tags et
  JOIN tags t ON et.tag_id = t.id
  JOIN emails e ON e.email_id = et.email_id
  WHERE t.user_id = user_id_param
    AND lower(t.name) = lower(tag_name_param);
$$;


ALTER FUNCTION "public"."get_email_ids_by_tag"("user_id_param" "uuid", "tag_name_param" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_emails_tagged_today"("user_id_param" "uuid") RETURNS SETOF "text"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT DISTINCT et.email_id
  FROM email_tags et
  WHERE et.user_id = user_id_param
    -- Filter for tags applied from the beginning of today (local time)
    -- until the beginning of tomorrow (local time)
    -- Adjust timezone handling if your server/users are in different timezones
    AND et.tagged_at >= date_trunc('day', now())
    AND et.tagged_at < date_trunc('day', now()) + interval '1 day';
$$;


ALTER FUNCTION "public"."get_emails_tagged_today"("user_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_default_tags_for_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  -- Insert default PIN tags
  insert into public.tags (user_id, name, type, color)
  values 
    (new.id, 'Events', 'pin', 'blue'),
    (new.id, 'Hotels', 'pin', 'green'),
    (new.id, 'Tickets', 'pin', 'purple');

  -- Insert default PRIORITY tags
  insert into public.tags (user_id, name, type, color)
  values 
    (new.id, 'Urgent', 'priority', 'red'),
    (new.id, 'Important', 'priority', 'orange'),
    (new.id, 'Waitlist', 'priority', 'yellow');

  return new;
end;
$$;


ALTER FUNCTION "public"."insert_default_tags_for_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."calendar_event_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "text" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."calendar_event_tags" OWNER TO "postgres";


COMMENT ON TABLE "public"."calendar_event_tags" IS 'Join table linking Google Calendar events to tags.';



COMMENT ON COLUMN "public"."calendar_event_tags"."event_id" IS 'References the unique ID of a Google Calendar event.';



CREATE TABLE IF NOT EXISTS "public"."custom_card_tags" (
    "card_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."custom_card_tags" OWNER TO "postgres";


COMMENT ON TABLE "public"."custom_card_tags" IS 'Join table linking custom cards to tags.';



CREATE TABLE IF NOT EXISTS "public"."custom_cards" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "title" "text",
    "content" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."custom_cards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."custom_cards_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "card_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "activity_type" "text" NOT NULL,
    "title" "text",
    "activity_timestamp" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "custom_cards_log_activity_type_check" CHECK (("activity_type" = ANY (ARRAY['CREATED'::"text", 'UPDATED'::"text", 'DELETED'::"text"])))
);


ALTER TABLE "public"."custom_cards_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."custom_cards_log" IS 'Logs creation, update, and deletion events for custom cards.';



CREATE TABLE IF NOT EXISTS "public"."email_tags" (
    "email_id" "text" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tagged_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."email_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."emails" (
    "email_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "is_starred" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "thread_id" "text"
);


ALTER TABLE "public"."emails" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."removed_email_tags_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email_id" "text" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "removed_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."removed_email_tags_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."removed_email_tags_log" IS 'Logs when tags are removed from emails for timeline.';



CREATE TABLE IF NOT EXISTS "public"."tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "color" "text" DEFAULT 'gray'::"text",
    CONSTRAINT "tags_type_check" CHECK (("type" = ANY (ARRAY['pin'::"text", 'priority'::"text"])))
);


ALTER TABLE "public"."tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."timeline_card_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "card_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."timeline_card_tags" OWNER TO "postgres";


COMMENT ON TABLE "public"."timeline_card_tags" IS 'Join table linking custom timeline cards to tags.';



COMMENT ON COLUMN "public"."timeline_card_tags"."card_id" IS 'References the custom timeline card.';



CREATE TABLE IF NOT EXISTS "public"."timeline_custom_cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "title_length_check" CHECK (("char_length"("title") > 0))
);


ALTER TABLE "public"."timeline_custom_cards" OWNER TO "postgres";


COMMENT ON TABLE "public"."timeline_custom_cards" IS 'Stores custom cards created by users for their timeline.';



COMMENT ON COLUMN "public"."timeline_custom_cards"."start_date" IS 'The date the custom event begins.';



COMMENT ON COLUMN "public"."timeline_custom_cards"."end_date" IS 'Optional date the custom event ends.';



ALTER TABLE ONLY "public"."calendar_event_tags"
    ADD CONSTRAINT "calendar_event_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_card_tags"
    ADD CONSTRAINT "custom_card_tags_pkey" PRIMARY KEY ("card_id", "tag_id");



ALTER TABLE ONLY "public"."custom_cards_log"
    ADD CONSTRAINT "custom_cards_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_cards"
    ADD CONSTRAINT "custom_cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_tags"
    ADD CONSTRAINT "email_tags_pkey" PRIMARY KEY ("email_id", "tag_id", "user_id");



ALTER TABLE ONLY "public"."emails"
    ADD CONSTRAINT "emails_pkey" PRIMARY KEY ("email_id");



ALTER TABLE ONLY "public"."removed_email_tags_log"
    ADD CONSTRAINT "removed_email_tags_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."timeline_card_tags"
    ADD CONSTRAINT "timeline_card_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."timeline_custom_cards"
    ADD CONSTRAINT "timeline_custom_cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_event_tags"
    ADD CONSTRAINT "unique_event_tag_user" UNIQUE ("event_id", "tag_id", "user_id");



ALTER TABLE ONLY "public"."timeline_card_tags"
    ADD CONSTRAINT "unique_timeline_card_tag_user" UNIQUE ("card_id", "tag_id", "user_id");



CREATE INDEX "idx_calendar_event_tags_event_id" ON "public"."calendar_event_tags" USING "btree" ("event_id");



CREATE INDEX "idx_calendar_event_tags_tag_id" ON "public"."calendar_event_tags" USING "btree" ("tag_id");



CREATE INDEX "idx_calendar_event_tags_user_id" ON "public"."calendar_event_tags" USING "btree" ("user_id");



CREATE INDEX "idx_custom_card_tags_card_id" ON "public"."custom_card_tags" USING "btree" ("card_id");



CREATE INDEX "idx_custom_card_tags_tag_id" ON "public"."custom_card_tags" USING "btree" ("tag_id");



CREATE INDEX "idx_custom_card_tags_user_id" ON "public"."custom_card_tags" USING "btree" ("user_id");



CREATE INDEX "idx_custom_cards_log_activity_type" ON "public"."custom_cards_log" USING "btree" ("activity_type");



CREATE INDEX "idx_custom_cards_log_card_id" ON "public"."custom_cards_log" USING "btree" ("card_id");



CREATE INDEX "idx_custom_cards_log_timestamp" ON "public"."custom_cards_log" USING "btree" ("activity_timestamp");



CREATE INDEX "idx_custom_cards_log_user_id" ON "public"."custom_cards_log" USING "btree" ("user_id");



CREATE INDEX "idx_email_tags_email" ON "public"."email_tags" USING "btree" ("email_id");



CREATE INDEX "idx_email_tags_user" ON "public"."email_tags" USING "btree" ("user_id");



CREATE INDEX "idx_removed_email_tags_log_email_id" ON "public"."removed_email_tags_log" USING "btree" ("email_id");



CREATE INDEX "idx_removed_email_tags_log_removed_at" ON "public"."removed_email_tags_log" USING "btree" ("removed_at");



CREATE INDEX "idx_removed_email_tags_log_tag_id" ON "public"."removed_email_tags_log" USING "btree" ("tag_id");



CREATE INDEX "idx_removed_email_tags_log_user_id" ON "public"."removed_email_tags_log" USING "btree" ("user_id");



CREATE INDEX "idx_tag_user" ON "public"."tags" USING "btree" ("user_id");



CREATE INDEX "idx_thread_id" ON "public"."emails" USING "btree" ("thread_id");



CREATE INDEX "idx_timeline_card_tags_card_id" ON "public"."timeline_card_tags" USING "btree" ("card_id");



CREATE INDEX "idx_timeline_card_tags_tag_id" ON "public"."timeline_card_tags" USING "btree" ("tag_id");



CREATE INDEX "idx_timeline_card_tags_user_id" ON "public"."timeline_card_tags" USING "btree" ("user_id");



CREATE INDEX "idx_timeline_custom_cards_start_date" ON "public"."timeline_custom_cards" USING "btree" ("start_date");



CREATE INDEX "idx_timeline_custom_cards_user_id" ON "public"."timeline_custom_cards" USING "btree" ("user_id");



CREATE INDEX "idx_user_id" ON "public"."emails" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "trigger_update_updated_at" BEFORE UPDATE ON "public"."emails" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."calendar_event_tags"
    ADD CONSTRAINT "calendar_event_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendar_event_tags"
    ADD CONSTRAINT "calendar_event_tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_card_tags"
    ADD CONSTRAINT "custom_card_tags_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "public"."custom_cards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_card_tags"
    ADD CONSTRAINT "custom_card_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_card_tags"
    ADD CONSTRAINT "custom_card_tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_cards_log"
    ADD CONSTRAINT "custom_cards_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_cards"
    ADD CONSTRAINT "custom_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."email_tags"
    ADD CONSTRAINT "email_tags_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "public"."emails"("email_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_tags"
    ADD CONSTRAINT "email_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_tags"
    ADD CONSTRAINT "email_tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."emails"
    ADD CONSTRAINT "fk_user" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."removed_email_tags_log"
    ADD CONSTRAINT "removed_email_tags_log_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."removed_email_tags_log"
    ADD CONSTRAINT "removed_email_tags_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."timeline_card_tags"
    ADD CONSTRAINT "timeline_card_tags_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "public"."timeline_custom_cards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."timeline_card_tags"
    ADD CONSTRAINT "timeline_card_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."timeline_card_tags"
    ADD CONSTRAINT "timeline_card_tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."timeline_custom_cards"
    ADD CONSTRAINT "timeline_custom_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Allow access to user's own emails" ON "public"."emails" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow insert for auth admin (default tags)" ON "public"."tags" FOR INSERT TO "supabase_auth_admin" WITH CHECK (true);



CREATE POLICY "Allow service role to insert activity logs" ON "public"."custom_cards_log" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow service role to insert removal logs" ON "public"."removed_email_tags_log" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow users to manage tags for their own cards" ON "public"."custom_card_tags" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to view their own card logs" ON "public"."custom_cards_log" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow users to view their own removed tag logs" ON "public"."removed_email_tags_log" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert/update/delete their email_tags" ON "public"."email_tags" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert/update/delete their tags" ON "public"."tags" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage tags for their own timeline cards" ON "public"."timeline_card_tags" USING ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."timeline_custom_cards"
  WHERE (("timeline_custom_cards"."id" = "timeline_card_tags"."card_id") AND ("timeline_custom_cards"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can manage their own calendar event tags" ON "public"."calendar_event_tags" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own timeline cards" ON "public"."timeline_custom_cards" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read their email_tags" ON "public"."email_tags" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read their tags" ON "public"."tags" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."calendar_event_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."custom_card_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."custom_cards_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."emails" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."removed_email_tags_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."timeline_card_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."timeline_custom_cards" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";




















































































































































































GRANT ALL ON FUNCTION "public"."get_email_ids_by_tag"("user_id_param" "uuid", "tag_name_param" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_email_ids_by_tag"("user_id_param" "uuid", "tag_name_param" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_email_ids_by_tag"("user_id_param" "uuid", "tag_name_param" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_emails_tagged_today"("user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_emails_tagged_today"("user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_emails_tagged_today"("user_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_default_tags_for_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."insert_default_tags_for_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_default_tags_for_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."calendar_event_tags" TO "anon";
GRANT ALL ON TABLE "public"."calendar_event_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_event_tags" TO "service_role";



GRANT ALL ON TABLE "public"."custom_card_tags" TO "anon";
GRANT ALL ON TABLE "public"."custom_card_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_card_tags" TO "service_role";



GRANT ALL ON TABLE "public"."custom_cards" TO "anon";
GRANT ALL ON TABLE "public"."custom_cards" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_cards" TO "service_role";



GRANT ALL ON TABLE "public"."custom_cards_log" TO "anon";
GRANT ALL ON TABLE "public"."custom_cards_log" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_cards_log" TO "service_role";



GRANT ALL ON TABLE "public"."email_tags" TO "anon";
GRANT ALL ON TABLE "public"."email_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."email_tags" TO "service_role";



GRANT ALL ON TABLE "public"."emails" TO "anon";
GRANT ALL ON TABLE "public"."emails" TO "authenticated";
GRANT ALL ON TABLE "public"."emails" TO "service_role";



GRANT ALL ON TABLE "public"."removed_email_tags_log" TO "anon";
GRANT ALL ON TABLE "public"."removed_email_tags_log" TO "authenticated";
GRANT ALL ON TABLE "public"."removed_email_tags_log" TO "service_role";



GRANT ALL ON TABLE "public"."tags" TO "anon";
GRANT ALL ON TABLE "public"."tags" TO "authenticated";
GRANT ALL ON TABLE "public"."tags" TO "service_role";
GRANT INSERT ON TABLE "public"."tags" TO "supabase_auth_admin";



GRANT ALL ON TABLE "public"."timeline_card_tags" TO "anon";
GRANT ALL ON TABLE "public"."timeline_card_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."timeline_card_tags" TO "service_role";



GRANT ALL ON TABLE "public"."timeline_custom_cards" TO "anon";
GRANT ALL ON TABLE "public"."timeline_custom_cards" TO "authenticated";
GRANT ALL ON TABLE "public"."timeline_custom_cards" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
