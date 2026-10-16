// ============================================================
// Basic helpers
// ============================================================
export const isEmpty = (element: unknown): boolean => {
  let empty = true;
  if (
    typeof element !== "undefined" &&
    element !== "null" &&
    element !== null &&
    element !== "" &&
    element !== "N/A"
  ) {
    empty = false;
  }
  return empty;
};

export const formatDate = (
  date: number | string,
  format = "d.m.Y H:i",
): string => {
  const d = new Date(parseInt(String(date), 10));
  const pad = (num: number) => (num < 10 ? "0" : "") + num;

  const yyyy = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const HH24 = pad(d.getHours());
  const hh12 = pad(d.getHours() % 12 || 12);
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  const ampm = d.getHours() < 12 ? "AM" : "PM";

  return format
    .replace("d", String(dd))
    .replace("m", String(MM))
    .replace("Y", String(yyyy))
    .replace("H", String(HH24))
    .replace("i", String(mm))
    .replace("s", String(ss))
    .replace("h", String(hh12))
    .replace("A", ampm);
};

export const roundNumber = (number: number, precision = 1000): number =>
  Math.round(number / precision) * precision;

export const setCookie = (cname: string, cvalue: string, hours = 12): void => {
  const d = new Date();
  d.setTime(d.getTime() + hours * 60 * 60 * 1000);
  const expires = "expires=" + d.toGMTString();
  document.cookie = `${cname}=${cvalue};${expires};path=/`;
};

export const getCookie = (cname: string): string => {
  const name = cname + "=";
  const decodedCookie = decodeURIComponent(document.cookie);
  const ca = decodedCookie.split(";");
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === " ") c = c.substring(1);
    if (c.indexOf(name) === 0) return c.substring(name.length, c.length);
  }
  return "";
};

export const sortList = <T = unknown>(
  arrayForSort: T[] = [],
  sort_by = "",
  asc = true,
): T[] => {
  const list = [...arrayForSort];
  if (!list.length) return list;

  if (sort_by === "") {
    let done = false;
    if (asc) {
      while (!done) {
        done = true;
        for (let i = 1; i < list.length; i += 1) {
          if ((list[i - 1] as any) > (list[i] as any)) {
            done = false;
            const tmp = list[i - 1];
            list[i - 1] = list[i];
            list[i] = tmp;
          }
        }
      }
    } else {
      while (!done) {
        done = true;
        for (let i = 1; i < list.length; i += 1) {
          if ((list[i - 1] as any) < (list[i] as any)) {
            done = false;
            const tmp = list[i - 1];
            list[i - 1] = list[i];
            list[i] = tmp;
          }
        }
      }
    }
  } else {
    let done = false;
    if (asc) {
      while (!done) {
        done = true;
        for (let i = 1; i < list.length; i += 1) {
          if ((list[i - 1] as any)[sort_by] > (list[i] as any)[sort_by]) {
            done = false;
            const tmp = list[i - 1];
            list[i - 1] = list[i];
            list[i] = tmp;
          }
        }
      }
    } else {
      while (!done) {
        done = true;
        for (let i = 1; i < list.length; i += 1) {
          if ((list[i - 1] as any)[sort_by] < (list[i] as any)[sort_by]) {
            done = false;
            const tmp = list[i - 1];
            list[i - 1] = list[i];
            list[i] = tmp;
          }
        }
      }
    }
  }
  return list;
};

export const getWindowDimensions = (): { width: number; height: number } => {
  const { innerWidth: width, innerHeight: height } = window;
  return { width, height };
};

export const capitalizeFirstLetter = (string: string): string => {
  if (string) return string.charAt(0).toUpperCase() + string.slice(1);
  return string;
};

export const randomIntFromInterval = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1) + min);

export const postData = async <T = unknown>(
  url = "",
  data: unknown = {},
): Promise<T> => {
  try {
    const response = await fetch(url, {
      method: "POST",
      mode: "cors",
      cache: "no-cache",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      redirect: "follow",
      referrerPolicy: "no-referrer",
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      console.error("response:", response);
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return response.json() as Promise<T>;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
};

export const getData = async <T = unknown>(url = ""): Promise<T> => {
  try {
    const response = await fetch(url, {
      method: "GET",
      mode: "cors",
      cache: "no-cache",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      redirect: "follow",
      referrerPolicy: "no-referrer",
    });
    if (!response.ok) {
      console.error("response:", response);
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return response.json() as Promise<T>;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
};

export const checkoutData = () => {
  const monthOptions = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];
  const date = new Date().getFullYear() - 1;
  const yearOptions = Array.from({ length: 10 }, (_, i) => i + date);
  return { monthOptions, yearOptions };
};

export const paymentErrors = () => ({
  name: {
    fill: true,
    validate: true,
    fill_message: "fill_field",
    validate_message: "validate_message_name",
  },
  email: {
    fill: true,
    validate: true,
    fill_message: "fill_field",
    validate_message: "validate_message_email",
  },
  phone: {
    fill: true,
    validate: true,
    fill_message: "fill_field",
    validate_message: "validate_message_phone",
  },
  country: {
    fill: true,
    validate: true,
    fill_message: "fill_field",
    validate_message: "validate_message_country",
  },
  city: {
    fill: true,
    validate: true,
    fill_message: "fill_field",
    validate_message: "validate_message_city",
  },
  cardNumber: {
    fill: true,
    validate: true,
    fill_message: "fill_field",
    validate_message: "validate_message_cardNumber",
  },
  month: {
    fill: true,
    validate: true,
    fill_message: "fill_field",
    validate_message: "validate_message_month",
  },
  year: {
    fill: true,
    validate: true,
    fill_message: "fill_field",
    validate_message: "validate_message_year",
  },
  cvv: {
    fill: true,
    validate: true,
    fill_message: "fill_field",
    validate_message: "validate_message_cvv",
  },
  bitcoinAddress: {
    fill: true,
    validate: true,
    fill_message: "fill_field",
    validate_message: "validate_message_bitcoinAddress",
  },
});

export interface CartItem {
  id: string | number;
  qty: number;
  cartId?: string | number;
}

export interface MarketItem {
  id: string | number;
  value: number;
  [key: string]: unknown;
}

export const getProducts = (
  cart: CartItem[],
  market: MarketItem[],
): (MarketItem & { qty: number; cardId?: string | number })[] => {
  const array: (MarketItem & { qty: number; cardId?: string | number })[] = [];
  for (const c of cart) {
    const index = market.findIndex((x) => x.id === c.id);
    if (index !== -1) {
      array.push({
        ...market[index],
        qty: c.qty,
        cardId: c.cartId,
      });
    }
  }
  return array;
};

export const convertCurrency = (
  value = 0,
  currency = "USD",
  exchangeRates: Record<string, number> | null = null,
  shorten = true,
): number => {
  if (value <= 0) {
    console.error("convertCurrency-value-error--> ", value);
    return value;
  }
  if (!exchangeRates) {
    console.error("convertCurrency-exchangeRates-error--> ", exchangeRates);
    return value;
  }
  const rate = exchangeRates[currency];
  if (!rate) {
    console.error("convertCurrency-rate-error--> ", rate);
    return value;
  }
  let result = parseFloat(String(value)) * rate;
  if (shorten) result = parseFloat(result.toFixed(2));
  return result;
};

export const showCardNumber = (value: string | null | undefined): string => {
  if (!value) return "";
  const lastFourDigits = value.slice(-4);
  return "***" + lastFourDigits;
};

export const getCarrotsFromProducts = (
  array: (MarketItem & { qty: number })[] | null | undefined,
): number => {
  let carrots = 0;
  if (array && array.length > 0) {
    for (const item of array) {
      carrots += item.qty * item.value;
    }
  }
  return carrots;
};

export const handleChangeTheme = (choice: string): void => {
  switch (choice) {
    case "green":
      document.documentElement.style.setProperty("--body_color", "green");
      document.documentElement.style.setProperty("--color", "gold");
      document.documentElement.style.setProperty(
        "--transparent_color",
        "rgba(255, 215, 0, 0.2)",
      );
      document.documentElement.style.setProperty("--dark_color", "#b39800");
      document.documentElement.style.setProperty("--light_color", "yellow");
      document.documentElement.style.setProperty(
        "--slot_canvas_color",
        "#fff7cc",
      );
      break;
    case "purple":
      document.documentElement.style.setProperty("--body_color", "purple");
      document.documentElement.style.setProperty("--color", "pink");
      document.documentElement.style.setProperty(
        "--transparent_color",
        "rgba(255, 105, 180, 0.2)",
      );
      document.documentElement.style.setProperty("--dark_color", "#7A1A7D");
      document.documentElement.style.setProperty("--light_color", "#d856dc");
      document.documentElement.style.setProperty(
        "--slot_canvas_color",
        "#ffccd5",
      );
      break;
    case "black":
      document.documentElement.style.setProperty("--body_color", "#333");
      document.documentElement.style.setProperty("--color", "#32CD32");
      document.documentElement.style.setProperty(
        "--transparent_color",
        "rgba(50, 205, 50, 0.2)",
      );
      document.documentElement.style.setProperty("--dark_color", "#006400");
      document.documentElement.style.setProperty("--light_color", "#00b300");
      document.documentElement.style.setProperty(
        "--slot_canvas_color",
        "#ccffcc",
      );
      break;
    case "blue":
      document.documentElement.style.setProperty("--body_color", "#3b5775");
      document.documentElement.style.setProperty("--color", "#ff8000");
      document.documentElement.style.setProperty(
        "--transparent_color",
        "rgba(255, 128, 0, 0.2)",
      );
      document.documentElement.style.setProperty("--dark_color", "#663300");
      document.documentElement.style.setProperty("--light_color", "#cc6600");
      document.documentElement.style.setProperty(
        "--slot_canvas_color",
        "#ffe6cc",
      );
      break;
    default:
      break;
  }
};

export const isNumber = (n: unknown): boolean =>
  !isNaN(parseFloat(String(n))) && !isNaN((n as number) - 0);

// ============================================================
// Error handling — plain, no Redux, no translate
// ============================================================
export type HandleErrors = (
  title?: string,
  text?: string,
  lang?: string,
) => void;

/**
 * Returns a callback for surfacing an error to the user.
 *
 * Currently just logs. Swap the body for whatever UI you prefer:
 *   - toast.error(`${title}: ${text}`)
 *   - window.alert(...)
 *   - open a shadcn Dialog
 *
 * The signature is stable so callers don't have to change.
 */
export const useHandleErrors = (): HandleErrors => {
  const handleErrors: HandleErrors = (
    title = "error",
    text = "",
    _lang = "ENG",
  ) => {
    // eslint-disable-next-line no-console
    console.warn(`[error] ${title}${text ? `: ${text}` : ""}`);
  };

  return handleErrors;
};

// ============================================================
// Bet validation
// ============================================================
export interface CheckBetsParams {
  bets: number;
  money: number;
  lang: string;
}

export const checkBets = (
  { bets, money, lang }: CheckBetsParams,
  handleErrors: HandleErrors,
): boolean => {
  if (bets > money) {
    handleErrors(
      "Insufficient Funds",
      "Your balance is too low to place this bet",
      lang,
    );
    return false;
  }
  return true;
};
