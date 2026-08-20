import { connectToMongoDB } from '../client';
import { UserWorkspace, ICanvas, INote } from '../models/UserWorkspace';

export class WorkspaceRepository {
  
  /**
   * 1. GET OR CREATE WORKSPACE
   * Called when a user logs in. If they don't have a workspace, initialize one.
   */
  static async getOrCreateWorkspace(userId: string) {
    await connectToMongoDB();
    
    // findOneAndUpdate with upsert: true and $setOnInsert
    // If it exists, return it. If not, create it using the defaults.
    return UserWorkspace.findOneAndUpdate(
      { userId }, // The query
      { $setOnInsert: { userId } }, // What to do if creating new
      { new: true, upsert: true } // Options: return the new doc, allow insert
    );
  }

  /**
   * 2. SAVE CANVAS (The Upsert Pattern for Arrays)
   * We want to update a specific canvas in the array. 
   * If it doesn't exist, we add it.
   */
  static async saveCanvas(userId: string, canvasData: ICanvas) {
    await connectToMongoDB();

    // Step 1: Try to update the existing canvas in the array
    const result = await UserWorkspace.updateOne(
      { userId, 'canvases.id': canvasData.id }, // Find the exact canvas
      { 
        $set: { 
          'canvases.$': canvasData // $ refers to the matched array element
        } 
      }
    );

    // Step 2: If no canvas was found to update, it's a new canvas. Push it.
    if (result.matchedCount === 0) {
      await UserWorkspace.updateOne(
        { userId },
        { $push: { canvases: canvasData } }
      );
    }
  }

  /**
   * 3. GET NOTES (Projection)
   * Don't fetch the 10MB of canvas data if the user just wants their notes list.
   */
  static async getNotesList(userId: string) {
    await connectToMongoDB();

    // The second argument is the "Projection". 
    // { notes: 1 } means "ONLY return the notes field, exclude everything else"
    const workspace = await UserWorkspace.findOne({ userId }, { notes: 1 }).lean();
    return workspace?.notes || [];
  }

  /**
   * 4. TRACK VIEW (The Bounded Array Pattern)
   * When a user views a lesson, add it to history.
   * We use $pull and $push to avoid duplicates and ensure recent ones are at the end.
   */
  static async trackRecentView(userId: string, itemId: string) {
    await connectToMongoDB();

    await UserWorkspace.updateOne(
      { userId },
      {
        // 1. Remove it if it already exists (so we can move it to the front)
        $pull: { recentViews: itemId }
      }
    );

    await UserWorkspace.updateOne(
      { userId },
      {
        $push: { 
          recentViews: {
            $each: [itemId], // The item to add
            $slice: -100 // MAGIC: Only keep the LAST 100 items in the array!
          }
        }
      }
    );
  }

  /**
   * 5. UPDATE SETTINGS (Dynamic Dot Notation)
   */
  static async updateSettings(userId: string, settingsUpdate: Partial<Record<string, any>>) {
    await connectToMongoDB();

    // Convert { theme: 'dark' } into { 'settings.theme': 'dark' }
    // This allows us to update nested fields without overwriting the whole settings object
    const updateObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(settingsUpdate)) {
      updateObj[`settings.${key}`] = value;
    }

    await UserWorkspace.updateOne(
      { userId },
      { $set: updateObj }
    );
  }

  static async getNotesState(userId: string) {
    await connectToMongoDB();
    const workspace = await UserWorkspace.findOne({ userId }).lean();
    if (!workspace) return null;
    return {
      notebooks: workspace.notebooks || [],
      notes: workspace.notes || [],
      tasks: workspace.tasks || [],
      selectedNotebookId: null,
      selectedNoteId: null,
      notebookSort: 'manual',
      noteSort: 'manual',
      filter: 'all'
    };
  }

  static async saveNotesState(userId: string, state: any) {
    await connectToMongoDB();
    await UserWorkspace.updateOne(
      { userId },
      { $set: { notebooks: state.notebooks || [], notes: state.notes || [], tasks: state.tasks || [] } },
      { upsert: true }
    );
  }
}
