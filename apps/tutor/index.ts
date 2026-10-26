// Entrada do app: registra o widget da tela inicial (Android) antes das rotas.
import { registrarWidget } from './src/widget/tarefaWidget';
import 'expo-router/entry';

registrarWidget();
