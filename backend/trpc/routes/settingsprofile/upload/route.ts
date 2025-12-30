import { publicProcedure } from '@/backend/trpc/create-context';
import { z } from 'zod';

export const uploadSettingsProfileProcedure = publicProcedure
  .input(
    z.object({
      siteId: z.string(),
      profileName: z.string(),
      profileData: z.any(),
      timestamp: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[tRPC] Uploading settings profile:', input.profileName);
    console.log('[tRPC] Site ID:', input.siteId);
    
    try {
      const API_BASE_URL = 'https://app.positron-portal.com/api/v1';
      const url = `${API_BASE_URL}/sites/${encodeURIComponent(input.siteId)}/data/settings-profile`;
      
      console.log('[tRPC] Posting to:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          profileName: input.profileName,
          profileData: input.profileData,
          timestamp: input.timestamp,
        }),
      });
      
      if (!response.ok) {
        const text = await response.text();
        console.error('[tRPC] Server error response:', response.status, text);
        throw new Error(`Server returned ${response.status}: ${text}`);
      }
      
      const result = await response.json().catch(() => ({ success: true }));
      console.log('[tRPC] Server response:', result);
      
      return {
        success: true,
        profileName: input.profileName,
        serverResponse: result,
      };
    } catch (error: any) {
      console.error('[tRPC] Error uploading profile to server:', error);
      
      return {
        success: false,
        profileName: input.profileName,
        error: error.message,
      };
    }
  });

export default uploadSettingsProfileProcedure;
