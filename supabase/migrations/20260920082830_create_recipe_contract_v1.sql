CREATE TABLE public.recipes (
    id text NOT NULL,
    name text NOT NULL,
    method text NULL,
    workplace text NULL,
    result_item_id text NOT NULL,
    result_quantity numeric NULL,
    status text NOT NULL DEFAULT 'curated',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT recipes_pkey PRIMARY KEY (id),
    CONSTRAINT recipes_result_item_id_fkey
        FOREIGN KEY (result_item_id)
        REFERENCES public.items(id)
        ON DELETE RESTRICT,
    CONSTRAINT recipes_result_quantity_positive
        CHECK (result_quantity IS NULL OR result_quantity > 0)
);

CREATE TABLE public.recipe_inputs (
    recipe_id text NOT NULL,
    item_id text NOT NULL,
    quantity numeric NULL,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT recipe_inputs_pkey PRIMARY KEY (recipe_id, item_id),
    CONSTRAINT recipe_inputs_recipe_id_fkey
        FOREIGN KEY (recipe_id)
        REFERENCES public.recipes(id)
        ON DELETE CASCADE,
    CONSTRAINT recipe_inputs_item_id_fkey
        FOREIGN KEY (item_id)
        REFERENCES public.items(id)
        ON DELETE RESTRICT,
    CONSTRAINT recipe_inputs_quantity_positive
        CHECK (quantity IS NULL OR quantity > 0)
);

CREATE TABLE public.recipe_sources (
    id bigint GENERATED ALWAYS AS IDENTITY,
    recipe_id text NOT NULL,
    source_type text NOT NULL,
    source_name text NOT NULL,
    source_url text NULL,
    checked_at timestamptz NOT NULL,
    claim_payload jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT recipe_sources_pkey PRIMARY KEY (id),
    CONSTRAINT recipe_sources_recipe_id_fkey
        FOREIGN KEY (recipe_id)
        REFERENCES public.recipes(id)
        ON DELETE RESTRICT,
    CONSTRAINT recipe_sources_source_type_not_blank
        CHECK (btrim(source_type) <> ''),
    CONSTRAINT recipe_sources_source_name_not_blank
        CHECK (btrim(source_name) <> ''),
    CONSTRAINT recipe_sources_source_url_not_blank
        CHECK (source_url IS NULL OR btrim(source_url) <> ''),
    CONSTRAINT recipe_sources_claim_payload_object
        CHECK (jsonb_typeof(claim_payload) = 'object')
);

CREATE INDEX recipes_result_item_id_idx
    ON public.recipes (result_item_id);

CREATE INDEX recipe_inputs_item_id_idx
    ON public.recipe_inputs (item_id);

CREATE INDEX recipe_sources_recipe_id_checked_at_idx
    ON public.recipe_sources (recipe_id, checked_at DESC);
