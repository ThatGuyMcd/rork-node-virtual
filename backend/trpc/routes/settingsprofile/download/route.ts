import { publicProcedure } from '@/backend/trpc/create-context';
import { z } from 'zod';

export const downloadSettingsProfileProcedure = publicProcedure
  .input(
    z.object({
      siteId: z.string(),
    })
  )
  .query(async ({ input }) => {
    console.log('[tRPC] Downloading settings profiles for site:', input.siteId);
    
    try {
      const API_BASE_URL = 'https://app.positron-portal.com';
      const listUrl = `${API_BASE_URL}/webviewfiles?SITEID=${encodeURIComponent(input.siteId)}&DIRECTORY=${encodeURIComponent('settings-profiles')}`;
      
      console.log('[tRPC] Fetching file list from:', listUrl);
      
      const listResponse = await fetch(listUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!listResponse.ok) {
        if (listResponse.status === 404) {
          console.log('[tRPC] No profiles folder found on server');
          return {
            success: true,
            profiles: [],
          };
        }
        const text = await listResponse.text();
        console.error('[tRPC] Server error response:', listResponse.status, text);
        throw new Error(`Server returned ${listResponse.status}: ${text}`);
      }
      
      const fileList = await listResponse.json();
      console.log('[tRPC] Files found:', fileList);
      
      if (!fileList.files || fileList.files.length === 0) {
        console.log('[tRPC] No profile files found');
        return {
          success: true,
          profiles: [],
        };
      }
      
      const profiles = [];
      for (const fileName of fileList.files) {
        if (!fileName.endsWith('.json')) continue;
        
        const fileUrl = `${API_BASE_URL}/webviewfiles?SITEID=${encodeURIComponent(input.siteId)}&FILE=${encodeURIComponent('settings-profiles/' + fileName)}`;
        console.log('[tRPC] Downloading profile:', fileUrl);
        
        try {
          const fileResponse = await fetch(fileUrl);
          if (fileResponse.ok) {
            const profileData = await fileResponse.json();
            profiles.push(profileData);
          }
        } catch (fileError) {
          console.error('[tRPC] Error downloading profile file:', fileName, fileError);
        }
      }
      
      console.log('[tRPC] Downloaded profiles count:', profiles.length);
      
      return {
        success: true,
        profiles,
      };
    } catch (error: any) {
      console.error('[tRPC] Error downloading profiles from server:', error);
      
      return {
        success: false,
        profiles: [],
        error: error.message,
      };
    }
  });

export default downloadSettingsProfileProcedure;
