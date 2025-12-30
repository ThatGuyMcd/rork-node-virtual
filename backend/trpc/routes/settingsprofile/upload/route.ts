import { publicProcedure } from '@/backend/trpc/create-context';
import { z } from 'zod';

export const uploadSettingsProfileProcedure = publicProcedure
  .input(
    z.object({
      siteId: z.string(),
      allProfiles: z.record(z.string(), z.any()),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[tRPC] Uploading all settings profiles');
    console.log('[tRPC] Site ID:', input.siteId);
    console.log('[tRPC] Profile count:', Object.keys(input.allProfiles).length);
    
    try {
      const fileData: Record<string, string> = {};
      for (const [profileName, profileInfo] of Object.entries(input.allProfiles)) {
        const fileName = `DATA/settings-profiles/${profileName}.json`;
        fileData[fileName] = JSON.stringify(profileInfo);
      }
      
      const uploadData = {
        SITEID: input.siteId,
        DESTINATIONWEBVIEWFOLDER: '',
        FOLDERDATA: ['DATA/settings-profiles'],
        FILEDATA: fileData,
      };
      
      console.log('[tRPC] Posting to: https://app.positron-portal.com/webviewdataupload');
      console.log('[tRPC] Uploading', Object.keys(fileData).length, 'profiles to DATA/settings-profiles folder');
      
      const response = await fetch('https://app.positron-portal.com/webviewdataupload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(uploadData),
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
        profileCount: Object.keys(input.allProfiles).length,
        serverResponse: result,
      };
    } catch (error: any) {
      console.error('[tRPC] Error uploading profiles to server:', error);
      
      return {
        success: false,
        error: error.message,
      };
    }
  });

export default uploadSettingsProfileProcedure;
