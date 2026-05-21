--
-- PostgreSQL database dump
--

\restrict enP8ysz27v8eZUnhc0r4iey8Kjc9YUTMMifWzbSLkzvmsXsrsrxvmpezya57dmK

-- Dumped from database version 18.4 (Debian 18.4-1.pgdg13+1)
-- Dumped by pg_dump version 18.4 (Ubuntu 18.4-1.pgdg26.04+1)

-- Started on 2026-05-19 15:10:00 JST

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

-- DROP DATABASE las;
--
-- TOC entry 3519 (class 1262 OID 16384)
-- Name: las; Type: DATABASE; Schema: -; Owner: las_user
--

-- CREATE DATABASE las WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'en_US.utf8';

ALTER DATABASE las OWNER TO las_user;

\unrestrict enP8ysz27v8eZUnhc0r4iey8Kjc9YUTMMifWzbSLkzvmsXsrsrxvmpezya57dmK
\connect las
\restrict enP8ysz27v8eZUnhc0r4iey8Kjc9YUTMMifWzbSLkzvmsXsrsrxvmpezya57dmK

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 226 (class 1259 OID 24667)
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
-- TOC entry 227 (class 1259 OID 24680)
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
-- TOC entry 224 (class 1259 OID 24638)
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
-- TOC entry 225 (class 1259 OID 24650)
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
-- TOC entry 219 (class 1259 OID 24576)
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
-- TOC entry 220 (class 1259 OID 24590)
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
-- TOC entry 221 (class 1259 OID 24603)
-- Name: checkpoint_migrations; Type: TABLE; Schema: public; Owner: las_user
--

CREATE TABLE public.checkpoint_migrations (
    v integer NOT NULL
);


ALTER TABLE public.checkpoint_migrations OWNER TO las_user;

--
-- TOC entry 222 (class 1259 OID 24609)
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
-- TOC entry 223 (class 1259 OID 24624)
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
-- TOC entry 3512 (class 0 OID 24667)
-- Dependencies: 226
-- Data for Name: ChatSession; Type: TABLE DATA; Schema: public; Owner: las_user
--

COPY public."ChatSession" (id, "userId", title, "createdAt", "updatedAt") FROM stdin;
\.


--
-- TOC entry 3513 (class 0 OID 24680)
-- Dependencies: 227
-- Data for Name: Message; Type: TABLE DATA; Schema: public; Owner: las_user
--

COPY public."Message" (id, "sessionId", role, content, "createdAt") FROM stdin;
\.


--
-- TOC entry 3510 (class 0 OID 24638)
-- Dependencies: 224
-- Data for Name: Role; Type: TABLE DATA; Schema: public; Owner: las_user
--

COPY public."Role" (id, name, description, permissions, "createdAt", "updatedAt") FROM stdin;
\.


--
-- TOC entry 3511 (class 0 OID 24650)
-- Dependencies: 225
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: las_user
--

COPY public."User" (id, email, "passwordHash", name, "roleId", "isActive", "lastLoginAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- TOC entry 3505 (class 0 OID 24576)
-- Dependencies: 219
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: las_user
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
853e55e2-1627-4b06-9ef2-9c52235d99f6	2660e15c87390aa138bd4f7cde3a74ceec30e32c09e6df22539aa46637638ef3	2026-05-19 06:09:16.742676+00	20260518071933	\N	\N	2026-05-19 06:09:16.702866+00	1
\.


--
-- TOC entry 3506 (class 0 OID 24590)
-- Dependencies: 220
-- Data for Name: checkpoint_blobs; Type: TABLE DATA; Schema: public; Owner: las_user
--

COPY public.checkpoint_blobs (thread_id, checkpoint_ns, channel, version, type, blob) FROM stdin;
\.


--
-- TOC entry 3507 (class 0 OID 24603)
-- Dependencies: 221
-- Data for Name: checkpoint_migrations; Type: TABLE DATA; Schema: public; Owner: las_user
--

COPY public.checkpoint_migrations (v) FROM stdin;
\.


--
-- TOC entry 3508 (class 0 OID 24609)
-- Dependencies: 222
-- Data for Name: checkpoint_writes; Type: TABLE DATA; Schema: public; Owner: las_user
--

COPY public.checkpoint_writes (thread_id, checkpoint_ns, checkpoint_id, task_id, idx, channel, type, blob) FROM stdin;
\.


--
-- TOC entry 3509 (class 0 OID 24624)
-- Dependencies: 223
-- Data for Name: checkpoints; Type: TABLE DATA; Schema: public; Owner: las_user
--

COPY public.checkpoints (thread_id, checkpoint_ns, checkpoint_id, parent_checkpoint_id, type, checkpoint, metadata) FROM stdin;
\.


--
-- TOC entry 3350 (class 2606 OID 24679)
-- Name: ChatSession ChatSession_pkey; Type: CONSTRAINT; Schema: public; Owner: las_user
--

ALTER TABLE ONLY public."ChatSession"
    ADD CONSTRAINT "ChatSession_pkey" PRIMARY KEY (id);


--
-- TOC entry 3353 (class 2606 OID 24692)
-- Name: Message Message_pkey; Type: CONSTRAINT; Schema: public; Owner: las_user
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_pkey" PRIMARY KEY (id);


--
-- TOC entry 3343 (class 2606 OID 24649)
-- Name: Role Role_pkey; Type: CONSTRAINT; Schema: public; Owner: las_user
--

ALTER TABLE ONLY public."Role"
    ADD CONSTRAINT "Role_pkey" PRIMARY KEY (id);


--
-- TOC entry 3347 (class 2606 OID 24666)
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: las_user
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- TOC entry 3332 (class 2606 OID 24589)
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: las_user
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- TOC entry 3334 (class 2606 OID 24602)
-- Name: checkpoint_blobs checkpoint_blobs_pkey; Type: CONSTRAINT; Schema: public; Owner: las_user
--

ALTER TABLE ONLY public.checkpoint_blobs
    ADD CONSTRAINT checkpoint_blobs_pkey PRIMARY KEY (thread_id, checkpoint_ns, channel, version);


--
-- TOC entry 3336 (class 2606 OID 24608)
-- Name: checkpoint_migrations checkpoint_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: las_user
--

ALTER TABLE ONLY public.checkpoint_migrations
    ADD CONSTRAINT checkpoint_migrations_pkey PRIMARY KEY (v);


--
-- TOC entry 3338 (class 2606 OID 24623)
-- Name: checkpoint_writes checkpoint_writes_pkey; Type: CONSTRAINT; Schema: public; Owner: las_user
--

ALTER TABLE ONLY public.checkpoint_writes
    ADD CONSTRAINT checkpoint_writes_pkey PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx);


--
-- TOC entry 3340 (class 2606 OID 24637)
-- Name: checkpoints checkpoints_pkey; Type: CONSTRAINT; Schema: public; Owner: las_user
--

ALTER TABLE ONLY public.checkpoints
    ADD CONSTRAINT checkpoints_pkey PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id);


--
-- TOC entry 3351 (class 1259 OID 24697)
-- Name: ChatSession_userId_idx; Type: INDEX; Schema: public; Owner: las_user
--

CREATE INDEX "ChatSession_userId_idx" ON public."ChatSession" USING btree ("userId");


--
-- TOC entry 3354 (class 1259 OID 24698)
-- Name: Message_sessionId_idx; Type: INDEX; Schema: public; Owner: las_user
--

CREATE INDEX "Message_sessionId_idx" ON public."Message" USING btree ("sessionId");


--
-- TOC entry 3341 (class 1259 OID 24693)
-- Name: Role_name_key; Type: INDEX; Schema: public; Owner: las_user
--

CREATE UNIQUE INDEX "Role_name_key" ON public."Role" USING btree (name);


--
-- TOC entry 3344 (class 1259 OID 24695)
-- Name: User_email_idx; Type: INDEX; Schema: public; Owner: las_user
--

CREATE INDEX "User_email_idx" ON public."User" USING btree (email);


--
-- TOC entry 3345 (class 1259 OID 24694)
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: las_user
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- TOC entry 3348 (class 1259 OID 24696)
-- Name: User_roleId_idx; Type: INDEX; Schema: public; Owner: las_user
--

CREATE INDEX "User_roleId_idx" ON public."User" USING btree ("roleId");


--
-- TOC entry 3356 (class 2606 OID 24704)
-- Name: ChatSession ChatSession_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: las_user
--

ALTER TABLE ONLY public."ChatSession"
    ADD CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3357 (class 2606 OID 24709)
-- Name: Message Message_sessionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: las_user
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES public."ChatSession"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 3355 (class 2606 OID 24699)
-- Name: User User_roleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: las_user
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public."Role"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


-- Completed on 2026-05-19 15:10:00 JST

--
-- PostgreSQL database dump complete
--

\unrestrict enP8ysz27v8eZUnhc0r4iey8Kjc9YUTMMifWzbSLkzvmsXsrsrxvmpezya57dmK

