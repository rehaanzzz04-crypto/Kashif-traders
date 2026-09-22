import { neon } from "@neondatabase/serverless";
import { getSessionUser } from "./api/_auth.js";

const db = () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw Error("DATABASE_URL_NOT_CONFIGURED");
  return neon(url);
};
const clean = (value) =>
  value === undefined || value === null ? null : String(value).trim() || null;
const asId = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
};
const requestBody = (req) =>
  typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
const imageList = (value) => {
  let list = value;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch {
      list = [];
    }
  }
  return (Array.isArray(list) ? list : [])
    .map(clean)
    .filter(Boolean)
    .slice(0, 3);
};
const isKgUnit = (unit) =>
  ["kg", "kgs", "kilogram", "kilograms"].includes(
    String(unit || "")
      .trim()
      .toLowerCase(),
  );
let schemaReady = false;

async function ensureSchema(sql) {
  if (schemaReady) return;
  await sql`CREATE TABLE IF NOT EXISTS gulshan_ecommerce_settings(id SMALLINT PRIMARY KEY DEFAULT 1 CHECK(id=1),store_name TEXT NOT NULL DEFAULT 'Gulshan Traders',contact_phone TEXT,shop_address TEXT,bank_details TEXT,easypaisa_number TEXT,jazzcash_number TEXT,delivery_fee NUMERIC(14,2) NOT NULL DEFAULT 0,updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  await sql`INSERT INTO gulshan_ecommerce_settings(id,store_name) VALUES(1,'Gulshan Traders') ON CONFLICT(id) DO NOTHING`;
  await sql`CREATE TABLE IF NOT EXISTS gulshan_ecommerce_products(id BIGSERIAL PRIMARY KEY,sku TEXT UNIQUE NOT NULL,name TEXT NOT NULL,category TEXT,description TEXT,unit TEXT NOT NULL DEFAULT 'pack',sale_price NUMERIC(14,2) NOT NULL DEFAULT 0,stock_quantity NUMERIC(14,3) NOT NULL DEFAULT 0,product_image_url TEXT,status TEXT NOT NULL DEFAULT 'active',created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  await sql`ALTER TABLE gulshan_ecommerce_products ADD COLUMN IF NOT EXISTS product_image_urls JSONB NOT NULL DEFAULT '[]'::jsonb`;
  await sql`UPDATE gulshan_ecommerce_products SET product_image_urls=jsonb_build_array(product_image_url) WHERE product_image_url IS NOT NULL AND trim(product_image_url)<>'' AND jsonb_array_length(product_image_urls)=0`;
  await sql`CREATE INDEX IF NOT EXISTS gulshan_ecommerce_products_catalog_idx ON gulshan_ecommerce_products(status,category,name)`;
  await sql`CREATE TABLE IF NOT EXISTS gulshan_ecommerce_categories(id BIGSERIAL PRIMARY KEY,name TEXT NOT NULL,sort_order INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'active',created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS gulshan_ecommerce_categories_name_uidx ON gulshan_ecommerce_categories(lower(name))`;
  await sql`INSERT INTO gulshan_ecommerce_categories(name) SELECT MIN(trim(category)) FROM gulshan_ecommerce_products WHERE category IS NOT NULL AND trim(category)<>'' GROUP BY lower(trim(category)) ON CONFLICT DO NOTHING`;
  await sql`CREATE TABLE IF NOT EXISTS gulshan_ecommerce_promotions(id BIGSERIAL PRIMARY KEY,title TEXT,subtitle TEXT,media_type TEXT NOT NULL,media_url TEXT NOT NULL,link_url TEXT,status TEXT NOT NULL DEFAULT 'active',sort_order INTEGER NOT NULL DEFAULT 0,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS gulshan_ecommerce_orders(id BIGSERIAL PRIMARY KEY,order_number TEXT UNIQUE NOT NULL,invoice_number TEXT UNIQUE NOT NULL,customer_name TEXT NOT NULL,phone TEXT NOT NULL,email TEXT,fulfilment_type TEXT NOT NULL,delivery_address TEXT,payment_method TEXT NOT NULL,payment_reference TEXT,items JSONB NOT NULL DEFAULT '[]'::jsonb,subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,delivery_fee NUMERIC(14,2) NOT NULL DEFAULT 0,total NUMERIC(14,2) NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'new',payment_status TEXT NOT NULL DEFAULT 'unpaid',notes TEXT,amount_received NUMERIC(14,2),paid_by_name TEXT,paid_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  await sql`CREATE INDEX IF NOT EXISTS gulshan_ecommerce_orders_status_idx ON gulshan_ecommerce_orders(status,created_at DESC)`;
  schemaReady = true;
}

async function catalog(sql, req) {
  const search = clean(req.query?.search) || "",
    like = `%${search}%`,
    category = clean(req.query?.category) || "";
  return sql`SELECT id,sku,name,category,description,unit,sale_price,product_image_url,product_image_urls,stock_quantity::numeric stock FROM gulshan_ecommerce_products WHERE status='active' AND sale_price>0 AND stock_quantity>0 AND (${search}='' OR name ILIKE ${like} OR COALESCE(sku,'') ILIKE ${like} OR COALESCE(category,'') ILIKE ${like}) AND (${category}='' OR lower(COALESCE(category,''))=lower(${category})) ORDER BY category,name LIMIT 300`;
}

async function createOrder(sql, req) {
  const body = requestBody(req),
    name = clean(body.customer_name),
    phone = clean(body.phone),
    fulfilment = clean(body.fulfilment_type),
    method = clean(body.payment_method),
    requested = Array.isArray(body.items) ? body.items : [];
  if (!name || !phone)
    return {
      status: 400,
      data: { error: "Customer name aur phone required hain" },
    };
  if (!["delivery", "pickup"].includes(fulfilment))
    return { status: 400, data: { error: "Delivery ya pickup select karein" } };
  if (fulfilment === "delivery" && !clean(body.delivery_address))
    return { status: 400, data: { error: "Delivery address required hai" } };
  if (
    !["Cash on Delivery", "Bank Transfer", "EasyPaisa", "JazzCash"].includes(
      method,
    )
  )
    return {
      status: 400,
      data: { error: "Valid payment method select karein" },
    };
  const quantityMap = new Map();
  for (const item of requested) {
    const productId = asId(item.product_id),
      quantity = Number(item.qty);
    if (productId && Number.isFinite(quantity) && quantity > 0)
      quantityMap.set(
        productId,
        Math.min(
          999,
          Number(((quantityMap.get(productId) || 0) + quantity).toFixed(3)),
        ),
      );
  }
  const ids = [...quantityMap.keys()];
  if (!ids.length)
    return { status: 400, data: { error: "Cart mein product add karein" } };
  const products =
    await sql`SELECT id,name,unit,sale_price,stock_quantity::numeric stock FROM gulshan_ecommerce_products WHERE id=ANY(${ids}::bigint[]) AND status='active'`;
  if (products.length !== ids.length)
    return {
      status: 409,
      data: { error: "Cart ka koi product ab available nahi" },
    };
  const items = [];
  for (const product of products) {
    const quantity = quantityMap.get(Number(product.id)),
      stock = Number(product.stock || 0),
      kg = isKgUnit(product.unit);
    if (kg) {
      if (
        quantity < 0.25 ||
        Math.abs(quantity * 4 - Math.round(quantity * 4)) > 0.000001
      )
        return {
          status: 400,
          data: {
            error: `${product.name}: minimum 250 gram aur 250 gram steps allowed hain`,
          },
        };
    } else if (quantity < 1 || !Number.isInteger(quantity))
      return {
        status: 400,
        data: { error: `${product.name}: quantity whole number honi chahiye` },
      };
    if (quantity > stock)
      return {
        status: 409,
        data: {
          error: `${product.name}: required quantity available nahi hai`,
        },
      };
    items.push({
      product_id: Number(product.id),
      name: product.name,
      unit: product.unit,
      qty: quantity,
      rate: Number(product.sale_price),
      total: quantity * Number(product.sale_price),
    });
  }
  if (method !== "Cash on Delivery" && !clean(body.payment_reference))
    return {
      status: 400,
      data: { error: "Transaction reference required hai" },
    };
  const settings = (
      await sql`SELECT delivery_fee FROM gulshan_ecommerce_settings WHERE id=1`
    )[0],
    subtotal = items.reduce((sum, item) => sum + item.total, 0),
    deliveryFee =
      fulfilment === "delivery"
        ? Math.max(0, Number(settings?.delivery_fee) || 0)
        : 0,
    total = subtotal + deliveryFee,
    orderNumber = `GT-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    invoiceNumber = `GTINV-${Date.now()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
    paymentStatus =
      method === "Cash on Delivery" ? "unpaid" : "pending_verification";
  for (const item of items) {
    const reserved =
      await sql`UPDATE gulshan_ecommerce_products SET stock_quantity=stock_quantity-${item.qty},updated_at=now() WHERE id=${item.product_id} AND stock_quantity>=${item.qty} RETURNING id`;
    if (!reserved[0]) {
      for (const done of items.slice(0, items.indexOf(item)))
        await sql`UPDATE gulshan_ecommerce_products SET stock_quantity=stock_quantity+${done.qty},updated_at=now() WHERE id=${done.product_id}`;
      return {
        status: 409,
        data: { error: `${item.name}: required quantity available nahi hai` },
      };
    }
  }
  try {
    const rows =
      await sql`INSERT INTO gulshan_ecommerce_orders(order_number,invoice_number,customer_name,phone,email,fulfilment_type,delivery_address,payment_method,payment_reference,items,subtotal,delivery_fee,total,payment_status,notes) VALUES(${orderNumber},${invoiceNumber},${name},${phone},${clean(body.email)},${fulfilment},${clean(body.delivery_address)},${method},${clean(body.payment_reference)},${JSON.stringify(items)},${subtotal},${deliveryFee},${total},${paymentStatus},${clean(body.notes)}) RETURNING *`;
    return { status: 201, data: { record: rows[0] } };
  } catch (error) {
    for (const item of items)
      await sql`UPDATE gulshan_ecommerce_products SET stock_quantity=stock_quantity+${item.qty},updated_at=now() WHERE id=${item.product_id}`;
    throw error;
  }
}

async function publicCategories(sql) {
  return sql`SELECT c.id,c.name,c.sort_order,c.status,COUNT(p.id) FILTER (WHERE p.status='active' AND p.sale_price>0 AND p.stock_quantity>0)::int product_count FROM gulshan_ecommerce_categories c LEFT JOIN gulshan_ecommerce_products p ON lower(COALESCE(p.category,''))=lower(c.name) WHERE c.status='active' GROUP BY c.id ORDER BY c.sort_order,c.name,c.id`;
}
async function manageCategories(sql, req) {
  const b = requestBody(req),
    id = asId(req.query?.id);
  if (req.method === "GET")
    return {
      status: 200,
      data: {
        records:
          await sql`SELECT c.*,COUNT(p.id)::int product_count FROM gulshan_ecommerce_categories c LEFT JOIN gulshan_ecommerce_products p ON lower(COALESCE(p.category,''))=lower(c.name) GROUP BY c.id ORDER BY c.sort_order,c.name,c.id`,
      },
    };
  const name = clean(b.name);
  if (req.method === "POST") {
    if (!name)
      return { status: 400, data: { error: "Category name required hai" } };
    const rows =
      await sql`INSERT INTO gulshan_ecommerce_categories(name,sort_order,status) VALUES(${name},${Math.trunc(Number(b.sort_order) || 0)},${clean(b.status) || "active"}) RETURNING *`;
    return { status: 201, data: { record: rows[0] } };
  }
  if (req.method === "PATCH" && id) {
    const cur = (
      await sql`SELECT * FROM gulshan_ecommerce_categories WHERE id=${id}`
    )[0];
    if (!cur) return { status: 404, data: { error: "Category not found" } };
    const next = name || cur.name;
    const rows =
      await sql`UPDATE gulshan_ecommerce_categories SET name=${next},sort_order=${Math.trunc(Number(b.sort_order ?? cur.sort_order) || 0)},status=${clean(b.status) || cur.status},updated_at=now() WHERE id=${id} RETURNING *`;
    if (next !== cur.name)
      await sql`UPDATE gulshan_ecommerce_products SET category=${next},updated_at=now() WHERE lower(COALESCE(category,''))=lower(${cur.name})`;
    return { status: 200, data: { record: rows[0] } };
  }
  if (req.method === "DELETE" && id) {
    const cur = (
      await sql`SELECT * FROM gulshan_ecommerce_categories WHERE id=${id}`
    )[0];
    if (!cur) return { status: 404, data: { error: "Category not found" } };
    const used =
      (
        await sql`SELECT COUNT(*)::int count FROM gulshan_ecommerce_products WHERE lower(COALESCE(category,''))=lower(${cur.name})`
      )[0]?.count || 0;
    if (used)
      return {
        status: 409,
        data: { error: "Is category mein products mojood hain" },
      };
    await sql`DELETE FROM gulshan_ecommerce_categories WHERE id=${id}`;
    return { status: 200, data: { deleted: true } };
  }
  return { status: 405, data: { error: "Method not allowed" } };
}
async function publicPromotions(sql) {
  return sql`SELECT id,title,subtitle,media_type,media_url,link_url,sort_order FROM gulshan_ecommerce_promotions WHERE status='active' ORDER BY sort_order,id LIMIT 30`;
}
async function managePromotions(sql, req) {
  const body = requestBody(req),
    id = asId(req.query?.id);
  if (req.method === "GET")
    return {
      status: 200,
      data: {
        records:
          await sql`SELECT * FROM gulshan_ecommerce_promotions ORDER BY sort_order,id`,
      },
    };
  if (req.method === "POST") {
    const url = clean(body.media_url),
      type = clean(body.media_type);
    if (!url || !["image", "video"].includes(type))
      return { status: 400, data: { error: "Valid media required hai" } };
    const rows =
      await sql`INSERT INTO gulshan_ecommerce_promotions(title,subtitle,media_type,media_url,link_url,status,sort_order) VALUES(${clean(body.title)},${clean(body.subtitle)},${type},${url},${clean(body.link_url)},${clean(body.status) || "active"},${Math.trunc(Number(body.sort_order) || 0)}) RETURNING *`;
    return { status: 201, data: { record: rows[0] } };
  }
  if (req.method === "PATCH" && id) {
    const rows =
      await sql`UPDATE gulshan_ecommerce_promotions SET title=CASE WHEN ${body.title !== undefined} THEN ${clean(body.title)} ELSE title END,subtitle=CASE WHEN ${body.subtitle !== undefined} THEN ${clean(body.subtitle)} ELSE subtitle END,media_type=COALESCE(${clean(body.media_type)},media_type),media_url=COALESCE(${clean(body.media_url)},media_url),link_url=CASE WHEN ${body.link_url !== undefined} THEN ${clean(body.link_url)} ELSE link_url END,status=COALESCE(${clean(body.status)},status),sort_order=COALESCE(${body.sort_order === undefined ? null : Math.trunc(Number(body.sort_order) || 0)},sort_order),updated_at=now() WHERE id=${id} RETURNING *`;
    return rows[0]
      ? { status: 200, data: { record: rows[0] } }
      : { status: 404, data: { error: "Promotion not found" } };
  }
  if (req.method === "DELETE" && id) {
    const rows =
      await sql`DELETE FROM gulshan_ecommerce_promotions WHERE id=${id} RETURNING id`;
    return { status: 200, data: { deleted: Boolean(rows[0]) } };
  }
  return { status: 405, data: { error: "Method not allowed" } };
}
async function manageOrders(sql, req, user) {
  if (req.method === "GET") {
    const status = clean(req.query?.status) || "all",
      rows =
        status === "all"
          ? await sql`SELECT * FROM gulshan_ecommerce_orders ORDER BY created_at DESC LIMIT 300`
          : await sql`SELECT * FROM gulshan_ecommerce_orders WHERE status=${status} ORDER BY created_at DESC LIMIT 300`;
    return { status: 200, data: { records: rows } };
  }
  const orderId = asId(req.query?.id),
    body = requestBody(req);
  if (req.method !== "PATCH" || !orderId)
    return { status: 405, data: { error: "Method not allowed" } };
  const current = (
    await sql`SELECT * FROM gulshan_ecommerce_orders WHERE id=${orderId}`
  )[0];
  if (!current)
    return { status: 404, data: { error: "Online order not found" } };
  const status = clean(body.status),
    paymentStatus = clean(body.payment_status),
    valid = [
      "new",
      "confirmed",
      "ready",
      "out_for_delivery",
      "completed",
      "cancelled",
    ];
  if (status && !valid.includes(status))
    return { status: 400, data: { error: "Invalid order status" } };
  if (
    paymentStatus &&
    !["unpaid", "pending_verification", "paid"].includes(paymentStatus)
  )
    return { status: 400, data: { error: "Invalid payment status" } };
  if (
    status === "completed" &&
    (paymentStatus || current.payment_status) !== "paid"
  )
    return {
      status: 409,
      data: { error: "Order complete karne se pehle payment Paid mark karein" },
    };
  if (current.status === "cancelled" && status && status !== "cancelled")
    return {
      status: 409,
      data: { error: "Cancelled order dobara open nahi ho sakta" },
    };
  if (status === "cancelled" && current.status !== "cancelled")
    for (const item of Array.isArray(current.items)
      ? current.items
      : JSON.parse(current.items || "[]"))
      await sql`UPDATE gulshan_ecommerce_products SET stock_quantity=stock_quantity+${Number(item.qty) || 0},updated_at=now() WHERE id=${asId(item.product_id)}`;
  const row = (
    await sql`UPDATE gulshan_ecommerce_orders SET status=COALESCE(${status},status),payment_status=COALESCE(${paymentStatus},payment_status),amount_received=CASE WHEN ${paymentStatus}='paid' THEN total ELSE amount_received END,paid_by_name=CASE WHEN ${paymentStatus}='paid' THEN ${user.full_name || user.employee_code} ELSE paid_by_name END,paid_at=CASE WHEN ${paymentStatus}='paid' THEN now() ELSE paid_at END,updated_at=now() WHERE id=${orderId} RETURNING *`
  )[0];
  return { status: 200, data: { record: row } };
}

async function manageProducts(sql, req) {
  const body = requestBody(req),
    productId = asId(req.query?.id);
  if (req.method === "GET")
    return {
      status: 200,
      data: {
        records:
          await sql`SELECT * FROM gulshan_ecommerce_products ORDER BY category,name,id`,
      },
    };
  if (req.method === "POST") {
    const name = clean(body.name),
      price = Number(body.sale_price),
      stock = Number(body.stock_quantity),
      images = imageList(body.product_image_urls),
      primary = images[0] || clean(body.product_image_url),
      gallery = images.length ? images : primary ? [primary] : [];
    if (
      !name ||
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isFinite(stock) ||
      stock < 0
    )
      return {
        status: 400,
        data: { error: "Product name, valid price aur stock required hain" },
      };
    const sku = clean(body.sku) || `GT-P-${Date.now()}`,
      rows =
        await sql`INSERT INTO gulshan_ecommerce_products(sku,name,category,description,unit,sale_price,stock_quantity,product_image_url,product_image_urls,status) VALUES(${sku},${name},${clean(body.category)},${clean(body.description)},${clean(body.unit) || "pack"},${price},${stock},${primary},${JSON.stringify(gallery)}::jsonb,${clean(body.status) || "active"}) RETURNING *`;
    return { status: 201, data: { record: rows[0] } };
  }
  if (req.method === "PATCH" && productId) {
    const price =
        body.sale_price === "" || body.sale_price === undefined
          ? null
          : Number(body.sale_price),
      stock =
        body.stock_quantity === "" || body.stock_quantity === undefined
          ? null
          : Number(body.stock_quantity);
    if (
      (price !== null && (!Number.isFinite(price) || price < 0)) ||
      (stock !== null && (!Number.isFinite(stock) || stock < 0))
    )
      return {
        status: 400,
        data: {
          error: "Price aur stock zero ya positive number honay chahiye",
        },
      };
    const status = clean(body.status);
    if (status && !["active", "inactive"].includes(status))
      return { status: 400, data: { error: "Invalid product status" } };
    const hasGallery = Array.isArray(body.product_image_urls),
      images = imageList(body.product_image_urls),
      primary = hasGallery ? images[0] || null : clean(body.product_image_url);
    const rows =
      await sql`UPDATE gulshan_ecommerce_products SET sku=COALESCE(${clean(body.sku)},sku),name=COALESCE(${clean(body.name)},name),category=${clean(body.category)},description=${clean(body.description)},unit=COALESCE(${clean(body.unit)},unit),sale_price=COALESCE(${price},sale_price),stock_quantity=COALESCE(${stock},stock_quantity),product_image_url=CASE WHEN ${hasGallery} THEN ${primary} ELSE COALESCE(${primary},product_image_url) END,product_image_urls=CASE WHEN ${hasGallery} THEN ${JSON.stringify(images)}::jsonb ELSE product_image_urls END,status=COALESCE(${status},status),updated_at=now() WHERE id=${productId} RETURNING *`;
    return rows[0]
      ? { status: 200, data: { record: rows[0] } }
      : { status: 404, data: { error: "Gulshan product not found" } };
  }
  if (req.method === "DELETE" && productId) {
    const rows =
      await sql`DELETE FROM gulshan_ecommerce_products WHERE id=${productId} RETURNING id`;
    return { status: 200, data: { deleted: Boolean(rows[0]) } };
  }
  return { status: 405, data: { error: "Method not allowed" } };
}

export default async function handler(req, res) {
  try {
    const sql = db(),
      action = clean(req.query?.action) || "catalog";
    await ensureSchema(sql);
    if (req.method === "GET" && action === "catalog")
      return res.status(200).json({ records: await catalog(sql, req) });
    if (
      req.method === "GET" &&
      action === "categories" &&
      req.query?.manage !== "1"
    )
      return res.status(200).json({ records: await publicCategories(sql) });
    if (
      req.method === "GET" &&
      action === "promotions" &&
      req.query?.manage !== "1"
    )
      return res.status(200).json({ records: await publicPromotions(sql) });
    if (req.method === "GET" && action === "config") {
      const rows =
        await sql`SELECT store_name,contact_phone,shop_address,bank_details,easypaisa_number,jazzcash_number,delivery_fee FROM gulshan_ecommerce_settings WHERE id=1`;
      return res.status(200).json({ record: rows[0] });
    }
    if (req.method === "POST" && action === "order") {
      const output = await createOrder(sql, req);
      return res.status(output.status).json(output.data);
    }
    const user = await getSessionUser(req, sql);
    if (!user)
      return res.status(401).json({ error: "Authentication required" });
    if (action === "products") {
      const output = await manageProducts(sql, req);
      return res.status(output.status).json(output.data);
    }
    if (action === "categories") {
      const output = await manageCategories(sql, req);
      return res.status(output.status).json(output.data);
    }
    if (action === "promotions") {
      const output = await managePromotions(sql, req);
      return res.status(output.status).json(output.data);
    }
    if (action === "settings") {
      if (req.method === "GET") {
        const rows =
          await sql`SELECT * FROM gulshan_ecommerce_settings WHERE id=1`;
        return res.status(200).json({ record: rows[0] });
      }
      if (req.method === "PATCH") {
        const body = requestBody(req),
          rows =
            await sql`UPDATE gulshan_ecommerce_settings SET store_name=COALESCE(${clean(body.store_name)},store_name),contact_phone=${clean(body.contact_phone)},shop_address=${clean(body.shop_address)},bank_details=${clean(body.bank_details)},easypaisa_number=${clean(body.easypaisa_number)},jazzcash_number=${clean(body.jazzcash_number)},delivery_fee=GREATEST(0,${Number(body.delivery_fee) || 0}),updated_at=now() WHERE id=1 RETURNING *`;
        return res.status(200).json({ record: rows[0] });
      }
    }
    const output = await manageOrders(sql, req, user);
    return res.status(output.status).json(output.data);
  } catch (error) {
    console.error("Gulshan Ecommerce API error", error);
    return res
      .status(500)
      .json({ error: error?.message || "Gulshan Ecommerce request failed" });
  }
}
