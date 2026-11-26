import { useState, useEffect, useCallback } from "react";
import type { ServiceType } from "@/shared/types";
import { apiRequest } from "@/shared/api/client";

export function useServiceTypes() {
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);

  const fetchServiceTypes = useCallback(async () => {
    setLoadingTypes(true);
    try {
      const res = await apiRequest<ServiceType[]>("/service-types?status=ACTIVE");
      setServiceTypes(res.data || []);
    } catch {
      // ignore
    } finally {
      setLoadingTypes(false);
    }
  }, []);

  useEffect(() => {
    fetchServiceTypes();
  }, [fetchServiceTypes]);

  return { serviceTypes, loadingTypes, fetchServiceTypes };
}
