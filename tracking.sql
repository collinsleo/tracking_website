--
-- PostgreSQL database dump
--

-- Dumped from database version 17.3
-- Dumped by pg_dump version 17.3

-- Started on 2025-05-14 14:57:58

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
-- TOC entry 220 (class 1259 OID 16415)
-- Name: parcels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.parcels (
    id integer NOT NULL,
    tracking_id character varying(100) NOT NULL,
    sender_name character varying(100),
    sender_phone character varying(100),
    receiver_name character varying(100),
    receiver_email character varying(100),
    receiver_phone character varying(100),
    pickup_location character varying(100),
    delivery_location character varying(100),
    weight integer,
    parcel_description character varying(100),
    note character varying(100),
    is_active text DEFAULT true,
    status character varying(50) DEFAULT 'processing'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    expected_arrival_time timestamp without time zone,
    current_location character varying(200)
);


ALTER TABLE public.parcels OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 16414)
-- Name: parcels_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.parcels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.parcels_id_seq OWNER TO postgres;

--
-- TOC entry 4871 (class 0 OID 0)
-- Dependencies: 219
-- Name: parcels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.parcels_id_seq OWNED BY public.parcels.id;


--
-- TOC entry 225 (class 1259 OID 16468)
-- Name: problem_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.problem_reports (
    id integer NOT NULL,
    parcel_id character varying(200),
    route_id integer,
    reported_by character varying(100) NOT NULL,
    reporter_role character varying(20) DEFAULT 'driver'::character varying,
    issue_type character varying(100) NOT NULL,
    priority character varying(50),
    description text,
    resolution_notes text,
    status character varying(20) DEFAULT 'open'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    resolved_at timestamp without time zone
);


ALTER TABLE public.problem_reports OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 16467)
-- Name: problem_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.problem_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.problem_reports_id_seq OWNER TO postgres;

--
-- TOC entry 4872 (class 0 OID 0)
-- Dependencies: 224
-- Name: problem_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.problem_reports_id_seq OWNED BY public.problem_reports.id;


--
-- TOC entry 223 (class 1259 OID 16437)
-- Name: routes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.routes (
    id integer NOT NULL,
    tracking_id character varying(200),
    from_location character varying(100),
    to_location character varying(100),
    transit_mode character varying(100),
    estimated_time character varying(50),
    status character varying(50) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    update_at timestamp without time zone DEFAULT now(),
    step_number integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.routes OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 16436)
-- Name: routes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.routes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.routes_id_seq OWNER TO postgres;

--
-- TOC entry 4873 (class 0 OID 0)
-- Dependencies: 222
-- Name: routes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.routes_id_seq OWNED BY public.routes.id;


--
-- TOC entry 221 (class 1259 OID 16428)
-- Name: session; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


ALTER TABLE public.session OWNER TO postgres;

--
-- TOC entry 227 (class 1259 OID 16505)
-- Name: tracking_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tracking_history (
    id integer NOT NULL,
    tracking_id character varying(50),
    route_id character varying(50),
    status character varying(50),
    notify_me character varying(20) DEFAULT 'false'::character varying,
    current_location character varying(100),
    description character varying(100),
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.tracking_history OWNER TO postgres;

--
-- TOC entry 226 (class 1259 OID 16504)
-- Name: tracking_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tracking_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tracking_history_id_seq OWNER TO postgres;

--
-- TOC entry 4874 (class 0 OID 0)
-- Dependencies: 226
-- Name: tracking_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tracking_history_id_seq OWNED BY public.tracking_history.id;


--
-- TOC entry 218 (class 1259 OID 16389)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(200) NOT NULL,
    mobile character varying(20) NOT NULL,
    role character varying(50) DEFAULT 'admin'::character varying,
    is_active text DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    password character varying(255) NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 217 (class 1259 OID 16388)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- TOC entry 4875 (class 0 OID 0)
-- Dependencies: 217
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 4670 (class 2604 OID 16418)
-- Name: parcels id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parcels ALTER COLUMN id SET DEFAULT nextval('public.parcels_id_seq'::regclass);


--
-- TOC entry 4680 (class 2604 OID 16471)
-- Name: problem_reports id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.problem_reports ALTER COLUMN id SET DEFAULT nextval('public.problem_reports_id_seq'::regclass);


--
-- TOC entry 4675 (class 2604 OID 16440)
-- Name: routes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.routes ALTER COLUMN id SET DEFAULT nextval('public.routes_id_seq'::regclass);


--
-- TOC entry 4684 (class 2604 OID 16508)
-- Name: tracking_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tracking_history ALTER COLUMN id SET DEFAULT nextval('public.tracking_history_id_seq'::regclass);


--
-- TOC entry 4665 (class 2604 OID 16392)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 4858 (class 0 OID 16415)
-- Dependencies: 220
-- Data for Name: parcels; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.parcels (id, tracking_id, sender_name, sender_phone, receiver_name, receiver_email, receiver_phone, pickup_location, delivery_location, weight, parcel_description, note, is_active, status, created_at, updated_at, expected_arrival_time, current_location) FROM stdin;
\.


--
-- TOC entry 4863 (class 0 OID 16468)
-- Dependencies: 225
-- Data for Name: problem_reports; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.problem_reports (id, parcel_id, route_id, reported_by, reporter_role, issue_type, priority, description, resolution_notes, status, created_at, resolved_at) FROM stdin;
\.


--
-- TOC entry 4861 (class 0 OID 16437)
-- Dependencies: 223
-- Data for Name: routes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.routes (id, tracking_id, from_location, to_location, transit_mode, estimated_time, status, created_at, update_at, step_number) FROM stdin;
\.


--
-- TOC entry 4859 (class 0 OID 16428)
-- Dependencies: 221
-- Data for Name: session; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.session (sid, sess, expire) FROM stdin;
-dagS3j2_V39uui-6QaWSJN-OFvGq1TY	{"cookie":{"originalMaxAge":86399996,"expires":"2025-05-15T19:49:34.467Z","httpOnly":true,"path":"/"},"passport":{"user":2},"flash":{}}	2025-05-15 12:58:09
\.


--
-- TOC entry 4865 (class 0 OID 16505)
-- Dependencies: 227
-- Data for Name: tracking_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tracking_history (id, tracking_id, route_id, status, notify_me, current_location, description, created_at) FROM stdin;
\.


--
-- TOC entry 4856 (class 0 OID 16389)
-- Dependencies: 218
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, name, email, mobile, role, is_active, created_at, updated_at, password) FROM stdin;
1	collins leo	mbamcolins0@gmail.com	08076502131	admin	true	2025-05-14 02:42:38.664425	2025-05-14 02:42:38.664425	$2b$10$up2QhBnxuS/Nv3Kvia0msua/QJD2N8dRyEES4Ecrv7mXk2SuxzNwW
2	testing	testing@gmail.com	08076502660	admin	true	2025-05-14 05:59:54.091784	2025-05-14 05:59:54.091784	$2b$10$lSsEhb7uN5p0eU7hGLcLE.JMEMeDvHstCJmxxIQnXSptbCp.ZUzs.
\.


--
-- TOC entry 4876 (class 0 OID 0)
-- Dependencies: 219
-- Name: parcels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.parcels_id_seq', 1, false);


--
-- TOC entry 4877 (class 0 OID 0)
-- Dependencies: 224
-- Name: problem_reports_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.problem_reports_id_seq', 1, false);


--
-- TOC entry 4878 (class 0 OID 0)
-- Dependencies: 222
-- Name: routes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.routes_id_seq', 1, false);


--
-- TOC entry 4879 (class 0 OID 0)
-- Dependencies: 226
-- Name: tracking_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tracking_history_id_seq', 1, false);


--
-- TOC entry 4880 (class 0 OID 0)
-- Dependencies: 217
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 2, true);


--
-- TOC entry 4694 (class 2606 OID 16425)
-- Name: parcels parcels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parcels
    ADD CONSTRAINT parcels_pkey PRIMARY KEY (id);


--
-- TOC entry 4696 (class 2606 OID 16427)
-- Name: parcels parcels_tracking_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parcels
    ADD CONSTRAINT parcels_tracking_number_key UNIQUE (tracking_id);


--
-- TOC entry 4703 (class 2606 OID 16479)
-- Name: problem_reports problem_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.problem_reports
    ADD CONSTRAINT problem_reports_pkey PRIMARY KEY (id);


--
-- TOC entry 4701 (class 2606 OID 16447)
-- Name: routes routes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.routes
    ADD CONSTRAINT routes_pkey PRIMARY KEY (id);


--
-- TOC entry 4699 (class 2606 OID 16434)
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- TOC entry 4705 (class 2606 OID 16512)
-- Name: tracking_history tracking_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tracking_history
    ADD CONSTRAINT tracking_history_pkey PRIMARY KEY (id);


--
-- TOC entry 4688 (class 2606 OID 16397)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 4690 (class 2606 OID 16399)
-- Name: users users_mobile_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_mobile_key UNIQUE (mobile);


--
-- TOC entry 4692 (class 2606 OID 16395)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4697 (class 1259 OID 16435)
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_session_expire" ON public.session USING btree (expire);


--
-- TOC entry 4707 (class 2606 OID 16480)
-- Name: problem_reports problem_reports_parcel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.problem_reports
    ADD CONSTRAINT problem_reports_parcel_id_fkey FOREIGN KEY (parcel_id) REFERENCES public.parcels(tracking_id) ON DELETE CASCADE;


--
-- TOC entry 4708 (class 2606 OID 16485)
-- Name: problem_reports problem_reports_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.problem_reports
    ADD CONSTRAINT problem_reports_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(id) ON DELETE CASCADE;


--
-- TOC entry 4706 (class 2606 OID 16448)
-- Name: routes routes_tracking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.routes
    ADD CONSTRAINT routes_tracking_id_fkey FOREIGN KEY (tracking_id) REFERENCES public.parcels(tracking_id) ON DELETE CASCADE;


--
-- TOC entry 4709 (class 2606 OID 16513)
-- Name: tracking_history tracking_history_tracking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tracking_history
    ADD CONSTRAINT tracking_history_tracking_id_fkey FOREIGN KEY (tracking_id) REFERENCES public.parcels(tracking_id) ON DELETE CASCADE;


-- Completed on 2025-05-14 14:57:59

--
-- PostgreSQL database dump complete
--

