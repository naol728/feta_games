interface Wallet {
  balance: number;
  locked_balance: number;
}
export interface User {
  id: string;
  telegram_id: number;
  username: string;
  created_at: string;
  updated_at: string;
  Fname: string;
  Lname: string;
  referral_id: string;
  wallets: Wallet;
}
export interface IMarketItem {
  _id: string;
  sellerId: {
    _id: string;
    username: string;
  };
  item: {
    _id: string;
    name: string;
    image: string;
    uniqueId: string;
  };
  price: number;
  itemName: string;
  itemImage: string;
  __v: number;
  uniqueId: string;
}

export interface BasicItem {
  case: string;
  image: string;
  name: string;
  rarity: number;
  _id: string;
  uniqueId: string;
  baseValue?: number;
  sellValue?: number;
  rollId?: string;
}

export interface Case {
  _id: string;
  title: string;
  price: number;
  image: string;
  items: BasicItem[];
}
