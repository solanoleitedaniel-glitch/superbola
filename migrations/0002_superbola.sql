-- Super Bola Pizzaria — cardápio, pedidos e operação.
-- Preços, bairros e horários abaixo são de demonstração.

create table if not exists store_settings (
  id int primary key default 1 check (id = 1),
  name text not null default 'Super Bola Pizzaria',
  phone text not null default '',
  whatsapp text not null default '',
  address_line text not null default '',
  city text not null default '',
  state text not null default '',
  timezone text not null default 'America/Sao_Paulo',
  hours jsonb not null default '[]'::jsonb,
  prep_minutes int not null default 40,
  pickup_minutes int not null default 25,
  min_order_cents int not null default 0,
  demo_notice boolean not null default true,
  payments jsonb not null default '{"cash":true,"card_delivery":true,"pix_online":false,"card_online":false}'::jsonb,
  pix_discount_bps int not null default 0,
  join_code text not null default 'EQUIPE-BOLA',
  price_rule text not null default 'max',
  force_status text not null default 'open',
  updated_at timestamptz not null default now()
);

create table if not exists staff (
  user_id text primary key,
  role text not null check (role in ('owner', 'staff')),
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  user_id text primary key,
  name text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists addresses (
  id text primary key,
  user_id text not null,
  label text not null default 'Casa',
  cep text not null default '',
  street text not null,
  number text not null,
  complement text not null default '',
  neighborhood text not null,
  city text not null,
  state text not null,
  reference text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists addresses_user_idx on addresses (user_id);

create table if not exists categories (
  id text primary key,
  name text not null,
  slug text not null unique,
  icon text not null default 'pizza',
  sort int not null default 0,
  active boolean not null default true
);

create table if not exists products (
  id text primary key,
  category_id text not null references categories (id),
  name text not null,
  description text not null default '',
  image text not null default '',
  kind text not null default 'simple',
  price_cents int not null default 0,
  active boolean not null default true,
  featured boolean not null default false,
  sort int not null default 0,
  badge text not null default ''
);

create table if not exists sizes (
  id text primary key,
  name text not null,
  max_flavors int not null default 1,
  sort int not null default 0,
  active boolean not null default true
);

create table if not exists flavor_prices (
  product_id text not null references products (id),
  size_id text not null references sizes (id),
  price_cents int not null,
  primary key (product_id, size_id)
);

create table if not exists crusts (
  id text primary key,
  name text not null,
  price_cents int not null default 0,
  active boolean not null default true,
  sort int not null default 0
);

create table if not exists extras (
  id text primary key,
  name text not null,
  price_cents int not null default 0,
  active boolean not null default true,
  sort int not null default 0
);

create table if not exists zones (
  id text primary key,
  neighborhood text not null,
  city text not null default '',
  fee_cents int not null,
  eta_minutes int not null default 45,
  active boolean not null default true
);

create table if not exists coupons (
  code text primary key,
  kind text not null check (kind in ('percent', 'fixed')),
  value int not null,
  min_cents int not null default 0,
  active boolean not null default true
);

create sequence if not exists order_number_seq start with 4500;

create table if not exists orders (
  id text primary key,
  number int not null,
  user_id text not null,
  client_token text not null unique,
  customer_name text not null,
  customer_phone text not null,
  mode text not null check (mode in ('delivery', 'pickup')),
  address_snapshot jsonb,
  zone_name text not null default '',
  status text not null,
  payment_method text not null,
  payment_status text not null,
  change_for_cents int,
  subtotal_cents int not null,
  delivery_cents int not null,
  discount_cents int not null,
  total_cents int not null,
  coupon_code text,
  notes text not null default '',
  eta_at timestamptz,
  pix_qr text,
  pix_qr_base64 text,
  pix_payment_id text,
  items jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_user_idx on orders (user_id, created_at desc);
create index if not exists orders_status_idx on orders (status, created_at desc);

create table if not exists order_events (
  id text primary key,
  order_id text not null references orders (id),
  status text not null,
  note text not null default '',
  actor_id text not null,
  created_at timestamptz not null default now()
);
create index if not exists order_events_order_idx on order_events (order_id, created_at);

create table if not exists payment_events (
  id text primary key,
  order_id text,
  provider text not null,
  external_id text,
  status text not null,
  created_at timestamptz not null default now()
);

insert into store_settings (
  id, hours, prep_minutes, pickup_minutes, demo_notice, payments, join_code, price_rule, force_status
) values (
  1,
  '[
    {"day":0,"open":"11:00","close":"23:00","closed":false},
    {"day":1,"open":"11:00","close":"23:00","closed":false},
    {"day":2,"open":"11:00","close":"23:00","closed":false},
    {"day":3,"open":"11:00","close":"23:00","closed":false},
    {"day":4,"open":"11:00","close":"23:00","closed":false},
    {"day":5,"open":"11:00","close":"23:00","closed":false},
    {"day":6,"open":"11:00","close":"23:00","closed":false}
  ]'::jsonb,
  40,
  25,
  true,
  '{"cash":true,"card_delivery":true,"pix_online":false,"card_online":false}'::jsonb,
  'EQUIPE-BOLA',
  'max',
  'open'
) on conflict (id) do nothing;

insert into categories (id, name, slug, icon, sort) values
  ('cat-pizzas', 'Pizzas', 'pizzas', 'pizza', 1),
  ('cat-refri', 'Refrigerantes', 'refrigerantes', 'cup', 2),
  ('cat-cervejas', 'Cervejas', 'cervejas', 'beer', 3),
  ('cat-combos', 'Combos', 'combos', 'combo', 4),
  ('cat-outros', 'Outros', 'outros', 'plus', 5)
on conflict (id) do nothing;

insert into sizes (id, name, max_flavors, sort) values
  ('size-p', 'Pequena', 1, 1),
  ('size-m', 'Média', 2, 2),
  ('size-g', 'Grande', 2, 3),
  ('size-gg', 'Gigante', 3, 4)
on conflict (id) do nothing;

insert into products (id, category_id, name, description, image, kind, price_cents, featured, sort, badge) values
  ('flav-calabresa', 'cat-pizzas', 'Calabresa', 'Molho de tomate, mussarela, calabresa fatiada e orégano.', '/menu/calabresa.jpg', 'pizza_flavor', 0, true, 1, ''),
  ('flav-portuguesa', 'cat-pizzas', 'Portuguesa', 'Mussarela, presunto, ovos, cebola, azeitonas e orégano.', '/menu/portuguesa.jpg', 'pizza_flavor', 0, false, 2, ''),
  ('flav-mussarela', 'cat-pizzas', 'Mussarela', 'Molho de tomate, mussarela e orégano.', '', 'pizza_flavor', 0, false, 3, ''),
  ('flav-super', 'cat-pizzas', 'Super Bola', 'Mussarela, calabresa, bacon, milho, cebola e azeitonas.', '/menu/calabresa.jpg', 'pizza_flavor', 0, true, 4, 'Mais pedida'),
  ('flav-quatro', 'cat-pizzas', 'Quatro queijos', 'Mussarela, provolone, parmesão e catupiry.', '', 'pizza_flavor', 0, false, 5, ''),
  ('drink-cola', 'cat-refri', 'Refrigerante de cola 2L', 'Garrafa de 2 litros. Marca a definir no cardápio real.', '', 'simple', 1200, false, 1, ''),
  ('drink-guarana', 'cat-refri', 'Refrigerante de guaraná 2L', 'Garrafa de 2 litros. Marca a definir no cardápio real.', '', 'simple', 1100, false, 2, ''),
  ('drink-agua', 'cat-refri', 'Água sem gás 500 ml', 'Garrafa individual.', '', 'simple', 400, false, 3, ''),
  ('drink-suco', 'cat-refri', 'Suco de lata', 'Lata 350 ml. Sabor a definir.', '', 'simple', 600, false, 4, ''),
  ('beer-lata', 'cat-cervejas', 'Cerveja lata', 'Lata 350 ml. Rótulo a definir no cardápio real.', '', 'simple', 500, false, 1, ''),
  ('beer-long', 'cat-cervejas', 'Cerveja long neck', 'Garrafa 330 ml. Rótulo a definir.', '', 'simple', 800, false, 2, ''),
  ('beer-600', 'cat-cervejas', 'Cerveja 600 ml', 'Garrafa 600 ml. Rótulo a definir.', '', 'simple', 1200, false, 3, ''),
  ('combo-familia', 'cat-combos', 'Combo família', 'Duas pizzas grandes de mussarela e um refrigerante de 2 litros. Itens de demonstração.', '/menu/portuguesa.jpg', 'combo', 10990, true, 1, 'Combo'),
  ('side-batata', 'cat-outros', 'Batata frita', 'Porção individual.', '', 'simple', 1890, false, 1, ''),
  ('side-pudim', 'cat-outros', 'Pudim', 'Fatia de pudim de leite.', '', 'simple', 1200, false, 2, '')
on conflict (id) do nothing;

insert into flavor_prices (product_id, size_id, price_cents) values
  ('flav-calabresa', 'size-p', 3290), ('flav-calabresa', 'size-m', 4290), ('flav-calabresa', 'size-g', 5290), ('flav-calabresa', 'size-gg', 6490),
  ('flav-portuguesa', 'size-p', 3690), ('flav-portuguesa', 'size-m', 4690), ('flav-portuguesa', 'size-g', 5690), ('flav-portuguesa', 'size-gg', 6890),
  ('flav-mussarela', 'size-p', 2990), ('flav-mussarela', 'size-m', 3990), ('flav-mussarela', 'size-g', 4890), ('flav-mussarela', 'size-gg', 5990),
  ('flav-super', 'size-p', 3990), ('flav-super', 'size-m', 4990), ('flav-super', 'size-g', 6290), ('flav-super', 'size-gg', 7490),
  ('flav-quatro', 'size-p', 3890), ('flav-quatro', 'size-m', 4890), ('flav-quatro', 'size-g', 5990), ('flav-quatro', 'size-gg', 7290)
on conflict (product_id, size_id) do nothing;

insert into crusts (id, name, price_cents, sort) values
  ('crust-none', 'Sem borda', 0, 1),
  ('crust-catupiry', 'Catupiry', 800, 2),
  ('crust-cheddar', 'Cheddar', 800, 3)
on conflict (id) do nothing;

insert into extras (id, name, price_cents, sort) values
  ('add-bacon', 'Bacon', 600, 1),
  ('add-azeitona', 'Azeitona', 400, 2),
  ('add-cebola', 'Cebola', 300, 3),
  ('add-milho', 'Milho', 300, 4)
on conflict (id) do nothing;

insert into zones (id, neighborhood, city, fee_cents, eta_minutes) values
  ('zone-centro', 'Centro (demonstração)', '', 700, 40),
  ('zone-jardim', 'Jardim (demonstração)', '', 900, 50)
on conflict (id) do nothing;

insert into coupons (code, kind, value, min_cents) values
  ('BEMVINDO', 'percent', 10, 0),
  ('SUPER5', 'fixed', 500, 4000)
on conflict (code) do nothing;
