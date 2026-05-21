--
-- PostgreSQL database cluster dump
--

-- Started on 2026-05-19 14:25:48 JST

\restrict mcmkhlecH9kjmf3cQmP9szA4osQEZrx9rbfgrX1fjBgeW3kigYM8kxkzpK18NU5

SET default_transaction_read_only = off;

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

--
-- Roles
--

CREATE ROLE las_user;
ALTER ROLE las_user WITH SUPERUSER INHERIT CREATEROLE CREATEDB LOGIN REPLICATION BYPASSRLS;

--
-- User Configurations
--








\unrestrict mcmkhlecH9kjmf3cQmP9szA4osQEZrx9rbfgrX1fjBgeW3kigYM8kxkzpK18NU5

--
-- Databases
--

--
-- Database "template1" dump
--

\connect template1

--
-- PostgreSQL database dump
--

\restrict vbJQ6uFJlZwttnMFC2g3BscZSNnW3O16ew8m90IMfushobJozZ9u8OGoPRTVaO4

-- Dumped from database version 18.4 (Debian 18.4-1.pgdg13+1)
-- Dumped by pg_dump version 18.4 (Ubuntu 18.4-1.pgdg26.04+1)

-- Started on 2026-05-19 14:25:48 JST

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- Completed on 2026-05-19 14:25:48 JST

--
-- PostgreSQL database dump complete
--

\unrestrict vbJQ6uFJlZwttnMFC2g3BscZSNnW3O16ew8m90IMfushobJozZ9u8OGoPRTVaO4

--
-- Database "las" dump
--

--
-- PostgreSQL database dump
--

\restrict qlwGkTkpbR4hoZa1JYC1JwMEEUjeYEbP8jXbB92AipqjYiLpec8DOiiAEYvPhKW

-- Dumped from database version 18.4 (Debian 18.4-1.pgdg13+1)
-- Dumped by pg_dump version 18.4 (Ubuntu 18.4-1.pgdg26.04+1)

-- Started on 2026-05-19 14:25:48 JST

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 3553 (class 1262 OID 16384)
-- Name: las; Type: DATABASE; Schema: -; Owner: las_user
--

CREATE DATABASE las WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'en_US.utf8';


ALTER DATABASE las OWNER TO las_user;

\unrestrict qlwGkTkpbR4hoZa1JYC1JwMEEUjeYEbP8jXbB92AipqjYiLpec8DOiiAEYvPhKW
\connect las
\restrict qlwGkTkpbR4hoZa1JYC1JwMEEUjeYEbP8jXbB92AipqjYiLpec8DOiiAEYvPhKW

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 2 (class 3079 OID 24714)
-- Name: pg_cron; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;


--
-- TOC entry 3554 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION pg_cron; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 228 (class 1259 OID 24667)
-- Name: ChatSession; Type: TABLE; Schema: public; Owner: las_user
--

CREATE TABLE public."ChatSession" (
    id text NOT NULL,
    "userId" text NOT NULL,
    title text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ChatSession" OWNER TO las_user;

--
-- TOC entry 229 (class 1259 OID 24680)
-- Name: Message; Type: TABLE; Schema: public; Owner: las_user
--

CREATE TABLE public."Message" (
    id text NOT NULL,
    "sessionId" text NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Message" OWNER TO las_user;

--
-- TOC entry 226 (class 1259 OID 24638)
-- Name: Role; Type: TABLE; Schema: public; Owner: las_user
--

CREATE TABLE public."Role" (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    permissions text[],
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Role" OWNER TO las_user;

--
-- TOC entry 227 (class 1259 OID 24650)
-- Name: User; Type: TABLE; Schema: public; Owner: las_user
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    name text NOT NULL,
    "roleId" text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "lastLoginAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."User" OWNER TO las_user;

--
-- TOC entry 221 (class 1259 OID 24576)
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: las_user
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO las_user;

--
-- TOC entry 222 (class 1259 OID 24590)
-- Name: checkpoint_blobs; Type: TABLE; Schema: public; Owner: las_user
--

CREATE TABLE public.checkpoint_blobs (
    thread_id text NOT NULL,
    checkpoint_ns text DEFAULT ''::text NOT NULL,
    channel text NOT NULL,
    version text NOT NULL,
    type text NOT NULL,
    blob bytea
);


ALTER TABLE public.checkpoint_blobs OWNER TO las_user;

--
-- TOC entry 223 (class 1259 OID 24603)
-- Name: checkpoint_migrations; Type: TABLE; Schema: public; Owner: las_user
--

CREATE TABLE public.checkpoint_migrations (
    v integer NOT NULL
);


ALTER TABLE public.checkpoint_migrations OWNER TO las_user;

--
-- TOC entry 224 (class 1259 OID 24609)
-- Name: checkpoint_writes; Type: TABLE; Schema: public; Owner: las_user
--

CREATE TABLE public.checkpoint_writes (
    thread_id text NOT NULL,
    checkpoint_ns text DEFAULT ''::text NOT NULL,
    checkpoint_id text NOT NULL,
    task_id text NOT NULL,
    idx integer NOT NULL,
    channel text NOT NULL,
    type text,
    blob bytea NOT NULL
);


ALTER TABLE public.checkpoint_writes OWNER TO las_user;

--
-- TOC entry 225 (class 1259 OID 24624)
-- Name: checkpoints; Type: TABLE; Schema: public; Owner: las_user
--

CREATE TABLE public.checkpoints (
    thread_id text NOT NULL,
    checkpoint_ns text DEFAULT ''::text NOT NULL,
    checkpoint_id text NOT NULL,
    parent_checkpoint_id text,
    type text,
    checkpoint jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);


ALTER TABLE public.checkpoints OWNER TO las_user;

--
-- TOC entry 3337 (class 0 OID 24717)
-- Dependencies: 231
-- Data for Name: job; Type: TABLE DATA; Schema: cron; Owner: las_user
--

COPY cron.job (jobid, schedule, command, nodename, nodeport, database, username, active, jobname) FROM stdin;
1	0 0 * * *	\n    DO i$\n    DECLARE\n        target_date TIMESTAMP := NOW() - INTERVAL '7 days';\n    BEGIN\n        -- A. Delete LangGraph Checkpoints first\n        -- The "thread_id" in checkpoint tables corresponds to "sessionId" in the Message table\n        -- which is the "id" in the ChatSession table.\n        \n        -- Delete from checkpoint_writes\n        DELETE FROM checkpoint_writes WHERE thread_id IN (\n            SELECT s.id FROM "ChatSession" s \n            JOIN "User" u ON s."userId" = u.id \n            WHERE u."createdAt" < target_date\n        );\n        \n        -- Delete from checkpoint_blobs\n        DELETE FROM checkpoint_blobs WHERE thread_id IN (\n            SELECT s.id FROM "ChatSession" s \n            JOIN "User" u ON s."userId" = u.id \n            WHERE u."createdAt" < target_date\n        );\n        \n        -- Delete from checkpoints\n        DELETE FROM checkpoints WHERE thread_id IN (\n            SELECT s.id FROM "ChatSession" s \n            JOIN "User" u ON s."userId" = u.id \n            WHERE u."createdAt" < target_date\n        );\n\n        -- B. Delete the Users\n        -- This will automatically cascade to "ChatSession" and "Message" \n        -- due to the 'onDelete: Cascade' defined in prisma/schema.prisma\n        DELETE FROM "User" WHERE "createdAt" < target_date;\n        \n        RAISE NOTICE 'Cleanup completed for users and data older than %', target_date;\n    END i$;\n	localhost	5432	las	las_user	t	daily-user-cleanup
\.


--
-- TOC entry 3339 (class 0 OID 24744)
-- Dependencies: 233
-- Data for Name: job_run_details; Type: TABLE DATA; Schema: cron; Owner: las_user
--

COPY cron.job_run_details (jobid, runid, job_pid, database, username, command, status, return_message, start_time, end_time) FROM stdin;
\.


--
-- TOC entry 3546 (class 0 OID 24667)
-- Dependencies: 228
-- Data for Name: ChatSession; Type: TABLE DATA; Schema: public; Owner: las_user
--

COPY public."ChatSession" (id, "userId", title, "createdAt", "updatedAt") FROM stdin;
\.


--
-- TOC entry 3547 (class 0 OID 24680)
-- Dependencies: 229
-- Data for Name: Message; Type: TABLE DATA; Schema: public; Owner: las_user
--

COPY public."Message" (id, "sessionId", role, content, "createdAt") FROM stdin;
\.


--
-- TOC entry 3544 (class 0 OID 24638)
-- Dependencies: 226
-- Data for Name: Role; Type: TABLE DATA; Schema: public; Owner: las_user
--

COPY public."Role" (id, name, description, permissions, "createdAt", "updatedAt") FROM stdin;
\.


--
-- TOC entry 3545 (class 0 OID 24650)
-- Dependencies: 227
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: las_user
--

COPY public."User" (id, email, "passwordHash", name, "roleId", "isActive", "lastLoginAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- TOC entry 3539 (class 0 OID 24576)
-- Dependencies: 221
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: las_user
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
69506e16-928e-4095-b8d9-eedbd3072bcf	2660e15c87390aa138bd4f7cde3a74ceec30e32c09e6df22539aa46637638ef3	2026-05-19 05:21:17.229307+00	20260518071933	\N	\N	2026-05-19 05:21:17.185741+00	1
\.


--
-- TOC entry 3540 (class 0 OID 24590)
-- Dependencies: 222
-- Data for Name: checkpoint_blobs; Type: TABLE DATA; Schema: public; Owner: las_user
--

COPY public.checkpoint_blobs (thread_id, checkpoint_ns, channel, version, type, blob) FROM stdin;
\.


--
-- TOC entry 3541 (class 0 OID 24603)
-- Dependencies: 223
-- Data for Name: checkpoint_migrations; Type: TABLE DATA; Schema: public; Owner: las_user
--

COPY public.checkpoint_migrations (v) FROM stdin;
0
1
2
3
4
\.


--
-- TOC entry 3542 (class 0 OID 24609)
-- Dependencies: 224
-- Data for Name: checkpoint_writes; Type: TABLE DATA; Schema: public; Owner: las_user
--

COPY public.checkpoint_writes (thread_id, checkpoint_ns, checkpoint_id, task_id, idx, channel, type, blob) FROM stdin;
\.


--
-- TOC entry 3543 (class 0 OID 24624)
-- Dependencies: 225
-- Data for Name: checkpoints; Type: TABLE DATA; Schema: public; Owner: las_user
--

COPY public.checkpoints (thread_id, checkpoint_ns, checkpoint_id, parent_checkpoint_id, type, checkpoint, metadata) FROM stdin;
\.


--
-- TOC entry 3555 (class 0 OID 0)
-- Dependencies: 230
-- Name: jobid_seq; Type: SEQUENCE SET; Schema: cron; Owner: las_user
--

SELECT pg_catalog.setval('cron.jobid_seq', 1, true);


--
-- TOC entry 3556 (class 0 OID 0)
-- Dependencies: 232
-- Name: runid_seq; Type: SEQUENCE SET; Schema: cron; Owner: las_user
--

SELECT pg_catalog.setval('cron.runid_seq', 1, false);


--
-- TOC entry 3378 (class 2606 OID 24679)
-- Name: ChatSession ChatSession_pkey; Type: CONSTRAINT; Schema: public; Owner: las_user
--

ALTER TABLE ONLY public."ChatSession"
    ADD CONSTRAINT "ChatSession_pkey" PRIMARY KEY (id);


--
-- TOC entry 3381 (class 2606 OID 24692)
-- Name: Message Message_pkey; Type: CONSTRAINT; Schema: public; Owner: las_user
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_pkey" PRIMARY KEY (id);


--
-- TOC entry 3371 (class 2606 OID 24649)
-- Name: Role Role_pkey; Type: CONSTRAINT; Schema: public; Owner: las_user
--

ALTER TABLE ONLY public."Role"
    ADD CONSTRAINT "Role_pkey" PRIMARY KEY (id);


--
-- TOC entry 3375 (class 2606 OID 24666)
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: las_user
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- TOC entry 3360 (class 2606 OID 24589)
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: las_user
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- TOC entry 3362 (class 2606 OID 24602)
-- Name: checkpoint_blobs checkpoint_blobs_pkey; Type: CONSTRAINT; Schema: public; Owner: las_user
--

ALTER TABLE ONLY public.checkpoint_blobs
    ADD CONSTRAINT checkpoint_blobs_pkey PRIMARY KEY (thread_id, checkpoint_ns, channel, version);


--
-- TOC entry 3364 (class 2606 OID 24608)
-- Name: checkpoint_migrations checkpoint_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: las_user
--

ALTER TABLE ONLY public.checkpoint_migrations
    ADD CONSTRAINT checkpoint_migrations_pkey PRIMARY KEY (v);


--
-- TOC entry 3366 (class 2606 OID 24623)
-- Name: checkpoint_writes checkpoint_writes_pkey; Type: CONSTRAINT; Schema: public; Owner: las_user
--

ALTER TABLE ONLY public.checkpoint_writes
    ADD CONSTRAINT checkpoint_writes_pkey PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx);


--
-- TOC entry 3368 (class 2606 OID 24637)
-- Name: checkpoints checkpoints_pkey; Type: CONSTRAINT; Schema: public; Owner: las_user
--

ALTER TABLE ONLY public.checkpoints
    ADD CONSTRAINT checkpoints_pkey PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id);


--
-- TOC entry 3379 (class 1259 OID 24697)
-- Name: ChatSession_userId_idx; Type: INDEX; Schema: public; Owner: las_user
--

CREATE INDEX "ChatSession_userId_idx" ON public."ChatSession" USING btree ("userId");


--
-- TOC entry 3382 (class 1259 OID 24698)
-- Name: Message_sessionId_idx; Type: INDEX; Schema: public; Owner: las_user
--

CREATE INDEX "Message_sessionId_idx" ON public."Message" USING btree ("sessionId");


--
-- TOC entry 3369 (class 1259 OID 24693)
-- Name: Role_name_key; Type: INDEX; Schema: public; Owner: las_user
--

CREATE UNIQUE INDEX "Role_name_key" ON public."Role" USING btree (name);


--
-- TOC entry 3372 (class 1259 OID 24695)
-- Name: User_email_idx; Type: INDEX; Schema: public; Owner: las_user
--

CREATE INDEX "User_email_idx" ON public."User" USING btree (email);


--
-- TOC entry 3373 (class 1259 OID 24694)
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: las_user
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- TOC entry 3376 (class 1259 OID 24696)
-- Name: User_roleId_idx; Type: INDEX; Schema: public; Owner: las_user
--

CREATE INDEX "User_roleId_idx" ON public."User" USING btree ("roleId");


--
-- TOC entry 3390 (class 2606 OID 24704)
-- Name: ChatSession ChatSession_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: las_user
--

ALTER TABLE ONLY public."ChatSession"
    ADD CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3391 (class 2606 OID 24709)
-- Name: Message Message_sessionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: las_user
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES public."ChatSession"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3389 (class 2606 OID 24699)
-- Name: User User_roleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: las_user
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public."Role"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


-- Completed on 2026-05-19 14:25:48 JST

--
-- PostgreSQL database dump complete
--

\unrestrict qlwGkTkpbR4hoZa1JYC1JwMEEUjeYEbP8jXbB92AipqjYiLpec8DOiiAEYvPhKW

--
-- Database "postgres" dump
--

\connect postgres

--
-- PostgreSQL database dump
--

\restrict yuizO4BolClkIdzFQNBy0s3bWHc1QI8CbFEXpBYi7LNVPWL5uYDfRpRdV5wUGps

-- Dumped from database version 18.4 (Debian 18.4-1.pgdg13+1)
-- Dumped by pg_dump version 18.4 (Ubuntu 18.4-1.pgdg26.04+1)

-- Started on 2026-05-19 14:25:48 JST

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- Completed on 2026-05-19 14:25:48 JST

--
-- PostgreSQL database dump complete
--

\unrestrict yuizO4BolClkIdzFQNBy0s3bWHc1QI8CbFEXpBYi7LNVPWL5uYDfRpRdV5wUGps

-- Completed on 2026-05-19 14:25:48 JST

--
-- PostgreSQL database cluster dump complete
--

