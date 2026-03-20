export interface MapRoom {
  id: string;
  name: string;
  nameHe: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface MapData {
  width: number;
  height: number;
  rooms: MapRoom[];
  robotPosition: { x: number; y: number };
  forbiddenZones: Array<{ x: number; y: number; width: number; height: number }>;
  chargingStation: { x: number; y: number };
}

export interface NavigationState {
  status: 'idle' | 'navigating' | 'arrived' | 'returning' | 'error';
  currentX: number;
  currentY: number;
  targetX?: number;
  targetY?: number;
  progress: number;
  speed: number;
}

export class MockAdapter {
  private static navigationState: NavigationState = {
    status: 'idle',
    currentX: 10,
    currentY: 10,
    progress: 0,
    speed: 5,
  };

  static generateMockMap(): MapData {
    return {
      width: 800,
      height: 600,
      rooms: [
        {
          id: 'living_room',
          name: 'Living Room',
          nameHe: 'סלון',
          x: 50,
          y: 50,
          width: 300,
          height: 200,
          color: '#e8f4f8',
        },
        {
          id: 'kitchen',
          name: 'Kitchen',
          nameHe: 'מטבח',
          x: 350,
          y: 50,
          width: 200,
          height: 200,
          color: '#fff3e0',
        },
        {
          id: 'bedroom1',
          name: "Child's Room 1",
          nameHe: 'חדר ילדים 1',
          x: 50,
          y: 300,
          width: 200,
          height: 200,
          color: '#f3e5f5',
        },
        {
          id: 'bedroom2',
          name: "Child's Room 2",
          nameHe: 'חדר ילדים 2',
          x: 300,
          y: 300,
          width: 200,
          height: 200,
          color: '#e8f5e9',
        },
        {
          id: 'bathroom',
          name: 'Bathroom',
          nameHe: 'חדר אמבטיה',
          x: 550,
          y: 250,
          width: 150,
          height: 150,
          color: '#e0f7fa',
        },
        {
          id: 'hallway',
          name: 'Hallway',
          nameHe: 'מסדרון',
          x: 250,
          y: 250,
          width: 50,
          height: 250,
          color: '#fafafa',
        },
      ],
      robotPosition: { x: 100, y: 130 },
      forbiddenZones: [
        { x: 550, y: 50, width: 200, height: 150 },
      ],
      chargingStation: { x: 70, y: 70 },
    };
  }

  static async navigateTo(targetX: number, targetY: number): Promise<void> {
    this.navigationState = {
      ...this.navigationState,
      status: 'navigating',
      targetX,
      targetY,
      progress: 0,
    };

    return new Promise(resolve => {
      const interval = setInterval(() => {
        this.navigationState.progress += 10;
        if (this.navigationState.progress >= 100) {
          this.navigationState.status = 'arrived';
          this.navigationState.currentX = targetX;
          this.navigationState.currentY = targetY;
          this.navigationState.progress = 100;
          clearInterval(interval);
          resolve();
        } else {
          const ratio = this.navigationState.progress / 100;
          this.navigationState.currentX = Math.round(
            this.navigationState.currentX + (targetX - this.navigationState.currentX) * ratio
          );
          this.navigationState.currentY = Math.round(
            this.navigationState.currentY + (targetY - this.navigationState.currentY) * ratio
          );
        }
      }, 500);
    });
  }

  static async playAudio(filePath: string, volume: number = 0.8): Promise<number> {
    // Simulate audio playback - returns duration in seconds
    const duration = Math.floor(Math.random() * 8) + 3;
    await new Promise(resolve => setTimeout(resolve, duration * 1000));
    return duration;
  }

  static async stop(): Promise<void> {
    this.navigationState.status = 'idle';
    this.navigationState.progress = 0;
  }

  static getState(): NavigationState {
    return { ...this.navigationState };
  }

  static generateCameraFrame(): string {
    // Return base64 placeholder for mock camera feed
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  }

  static simulateWakeDetection(): { confidence: number; status: 'sleeping' | 'stirring' | 'awake' } {
    const confidence = Math.random();
    let status: 'sleeping' | 'stirring' | 'awake';

    if (confidence < 0.3) {
      status = 'sleeping';
    } else if (confidence < 0.7) {
      status = 'stirring';
    } else {
      status = 'awake';
    }

    return { confidence, status };
  }
}
