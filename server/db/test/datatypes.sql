drop table public.data_types;
CREATE TABLE public.data_types
(
	"id" bigserial NOT NULL,
	"boolean_b" boolean,
	"char" "char",
	"date" date,
	"timestamp" timestamp without time zone,
	"timestamp_tz" timestamp with time zone,
	"time" time without time zone,
	"decimal_nine_zero" decimal(9,0),
	"decimal_ten_zero" decimal(10,0),
	"decimal_eighteen_zero" decimal(18,0),
	"decimal_nineteen_zero" decimal(19,0),
	"decimal_ten_two" decimal(10,2),
	"numeric_ten_two" numeric(10,2),
	"smallint" smallint,
	"integer" integer,
	"bigint" bigint,
	"float" real,
	"double" double precision,
	"guid" uuid,
	"xml" xml,
	"varchar10" varchar(10),
	"char10" char(10),
	"text" text COLLATE pg_catalog."default",
	"bytea" bytea,
	"json" json,
	CONSTRAINT "Foo_pkey" PRIMARY KEY (id)
);
grant all on data_types to admin;
grant select,usage on sequence public.data_types_id_seq TO admin;
