
-- This SQL script creates a database and a table for storing user information.

CREATE TABLE users (
    id serial primary key NOT NULL,
    name varchar(100) NOT NULL,
    email varchar(200) NOT NULL,
    mobile varchar(20) NOT NULL,
    role varchar(50) DEFAULT 'admin',
	is_active varchar(20) default 'true',
    created_at timestamp DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp DEFAULT CURRENT_TIMESTAMP,
    password varchar(255) NOT NULL
);

CREATE TABLE "session" (
    "sid" varchar NOT NULL COLLATE "default",
    "sess" json NOT NULL,
    "expire" timestamp(6) NOT NULL
);

ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid");

CREATE INDEX "IDX_session_expire" ON "session" ("expire");


CREATE TABLE parcels (
    id serial primary key NOT NULL,
    tracking_id character varying(100) NOT NULL unique,
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
    current_location text
);

CREATE TABLE tracking_history (
    id serial primary key NOT NULL,
    tracking_id character varying(50),
    route_id character varying(50),
    status character varying(50),
    notify_me character varying(20) DEFAULT 'false',
    current_location character varying(100),
    description TEXT,
    created_at timestamp without time zone DEFAULT now()
);

CREATE TABLE routes (
    id serial primary key NOT NULL,
    tracking_id varchar NOT NULL REFERENCES parcels(tracking_id) ON DELETE CASCADE,
    from_location character varying(100),
    to_location character varying(100),
    transit_mode character varying(100),
    estimated_time character varying(50),
    status character varying(50) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    update_at timestamp without time zone DEFAULT now(),
    step_number integer DEFAULT 1 NOT NULL
);


CREATE TABLE problem_reports (
    id SERIAL PRIMARY KEY not null,
    parcel_id varchar NOT NULL REFERENCES parcels(tracking_id) ON DELETE CASCADE,
    route_id int NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    reported_by varchar(100) not null,
    reporter_role varchar(50) not null,
    issue_type varchar(50) not null,
    priority varchar(50) not null,
    description TEXT NOT NULL,
    status varchar(50) ,
    resolution_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);