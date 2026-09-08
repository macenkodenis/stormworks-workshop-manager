from typing import List, Dict, Any
from ..db.session import get_connection

class UnsubscribeProvider:
    @staticmethod
    def generate_dry_run_plan(item_ids: List[str]) -> Dict[str, Any]:
        """
        Calculates impact of unsubscribing without touching any files.
        """
        if not item_ids:
            return {
                "selected_count": 0,
                "total_reclaimable_bytes": 0,
                "items": []
            }

        conn = get_connection()
        cur = conn.cursor()
        placeholders = ",".join(["?"] * len(item_ids))
        cur.execute(f"""
            SELECT published_file_id, api_title, local_size_bytes, api_file_size, local_path, api_preview_url
            FROM workshop_items
            WHERE published_file_id IN ({placeholders})
        """, item_ids)
        rows = cur.fetchall()
        conn.close()

        items_plan = []
        total_bytes = 0
        for r in rows:
            size = r["local_size_bytes"] or r["api_file_size"] or 0
            total_bytes += size
            items_plan.append({
                "published_file_id": r["published_file_id"],
                "title": r["api_title"] or f"Item {r['published_file_id']}",
                "size_bytes": size,
                "local_path": r["local_path"],
                "workshop_url": f"https://steamcommunity.com/sharedfiles/filedetails/?id={r['published_file_id']}"
            })

        return {
            "selected_count": len(items_plan),
            "total_reclaimable_bytes": total_bytes,
            "total_reclaimable_mb": round(total_bytes / (1024 * 1024), 2),
            "total_reclaimable_gb": round(total_bytes / (1024 * 1024 * 1024), 2),
            "items": items_plan
        }

    @staticmethod
    def generate_browser_helper_script(item_ids: List[str]) -> str:
        """
        Generates a 100% transparent and safe JavaScript snippet that user can run
        in their own browser console while viewing their Steam Workshop Subscribed Items page.
        """
        ids_js = ", ".join([f"'{x}'" for x in item_ids])
        script = f"""// Safe Workshop Bulk Unsubscribe Helper
// Run this in developer console (F12) on your Steam Subscriptions page:
// https://steamcommunity.com/id/YOUR_ID/myworkshopfiles/?appid=573090&browsefilter=mysubscriptions
(() => {{
  const targetIds = new Set([{ids_js}]);
  console.log(`Looking for ${{targetIds.size}} items to unsubscribe...`);
  let count = 0;
  targetIds.forEach(id => {{
    const el = document.getElementById(`SubscriptionItem_${{id}}`) || document.querySelector(`[data-publishedfileid="${{id}}"]`);
    if (el) {{
      const btn = el.querySelector('.btn_unsubscribe, .btn_unfollow, [onclick*="Unsubscribe"]');
      if (btn) {{
        btn.click();
        count++;
      }}
    }}
  }});
  console.log(`Triggered unsubscribe for ${{count}} items visible on this page.`);
}})();"""
        return script
