/** Consumer subset verified against Floppy 928bc403, contracts/openapi.yaml and
 * serializers.py. Nested item/related fields are refined from source because
 * OpenAPI declares these as additionalProperties. See docs/API.md. */
export interface Item {
  media_id: string; source: string; title: string; image: string | null;
  season_number: number | null; episode_number: number | null;
  release_datetime: string | null;
  status?: string | null;
}
export interface TrackedMedia {
  item: Item | null; item_id: string | null; status: number | null;
  tracked: boolean; episodes_left: number | null; total_episodes_left: number | null;
  next_episode: {season_number:number|null;episode_number:number;air_date:string|null} | null;
  end_date: string | null;
  progress?: number | null;
  /** Client-only optimistic state, never sent to Floppy or stored in its history. */
  optimisticWatched?: boolean;
}
export interface Page<T> {
  results:T[];
  pagination:{total:number;limit:number;offset:number;next:string|null;previous:string|null};
}
export interface CompleteMedia {
  title:string|null; image:string|null; synopsis:string|null;
  details:{next_episode_season?:number|null;status?:string;last_air_date?:string|null};
  related:{seasons?:TrackedMedia[];episodes?:TrackedMedia[]};
}
export interface Upcoming { date:string|null }
export interface FeedEntry {row:TrackedMedia;next:Upcoming|null;lastAirDate:string|null}
export interface FeedResponse {
  ready:boolean;entries:FeedEntry[];updatedAt:string|null;refreshing:boolean;error:string|null;
}
