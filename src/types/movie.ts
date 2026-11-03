export type Genre = 'Action' | 'Comedy' | 'Drama' | 'Horror';

export type Status = 'Plan to Watch' | 'Watching' | 'Watched';

export interface Movie {
  id: string;
  userId: string;
  title: string;
  director: string;
  genre: Genre;
  status: Status;
  rating?: number | null;
  favorite: boolean;
  notes?: string;
  createdAt: any;
}

export type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  Register: undefined;
  List: undefined;
  Detail: { movieId: string };
};

