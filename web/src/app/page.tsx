import { CrudeToPump } from "@/components/CrudeToPump";
import { FxSection } from "@/components/FxSection";
import { PriceHistory } from "@/components/PriceHistory";
import { RecentChanges } from "@/components/RecentChanges";
import { TodayPrices } from "@/components/TodayPrices";

export default function Home() {
  return (
    <>
      <TodayPrices />
      <CrudeToPump />
      <PriceHistory />
      <FxSection />
      <RecentChanges />
    </>
  );
}
